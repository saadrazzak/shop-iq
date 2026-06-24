/** Real price history sourced by asking Amazon's on-page AI assistant (Rufus) and parsing its text response. */
import type { ProductData } from "../../shared/types";
import { getConfig } from "../../config";
import { parseNumericValue } from "../../shared/utils/format";

export type PricePoint = {
  /** Date label as returned by the assistant, e.g. "14 May". */
  label: string;
  /** Price in INR. */
  price: number;
};

export type PriceHistoryStats = {
  lowest: PricePoint;
  highest: PricePoint;
  current: PricePoint;
  average: number;
  /** This week's average price vs. the week before it, as a rounded percentage (positive = this week cost more). `null` if there isn't two full weeks of data. A fact about what already happened, not a forecast. */
  weeklyChangePercent: number | null;
  /** How many days of data the stats were computed over (matches the points array length). Drives the "in N days" wording in getPriceAlert. */
  windowDays: number;
};

export type PriceHistoryData = {
  points: PricePoint[];
  stats: PriceHistoryStats;
  fetchedAt: number;
};

/**
 * Which display window the Price History tab/overlay is showing. "1m"/"3m"
 * slice the one auto-fetched daily series (no extra fetch on switch); "1y"
 * is a separate, on-demand, weekly-resolution fetch the user has to trigger
 * (see `loadYearlyPriceHistory`) - it never slices the daily series.
 */
export type PriceHistoryRange = "1m" | "3m" | "1y";

/** The two ranges backed by the single daily fetch (as opposed to "1y"'s separate weekly fetch). */
export type DailyPriceHistoryRange = "1m" | "3m";

/** Nominal length of each daily window, in days. "3m" is also the target the limited-history check compares against, even though sliceForRange shows everything fetched for it rather than capping at 90. */
const RANGE_TARGET_DAYS: Record<DailyPriceHistoryRange, number> = {
  "1m": 30,
  "3m": 90
};

/** How many weekly entries a full 1-year fetch nominally has. */
const YEARLY_TARGET_WEEKS = 52;

/** Friendly label for each range, shared by the tab header and the limited-history notice. */
export const RANGE_LABEL: Record<PriceHistoryRange, string> = {
  "1m": "30 days",
  "3m": "3 months",
  "1y": "1 year"
};

/** Slices to the requested window, degrading gracefully if Rufus returned fewer days than asked (e.g. a "1m" tab on a product with only 20 days of real history just shows those 20). "3m" is uncapped - it shows everything fetched. */
export function sliceForRange(points: PricePoint[], range: DailyPriceHistoryRange): PricePoint[] {
  return range === "3m" ? points : points.slice(-RANGE_TARGET_DAYS[range]);
}

export type PriceHistoryCoverage = {
  /** How many data points were actually parsed out of the assistant's response, in `unit`s. */
  availableCount: number;
  /** "day" for the 1m/3m ranges, "week" for the 1-year range. */
  unit: "day" | "week";
  /** Friendly label for the selected range's nominal window, e.g. "3 months". */
  targetLabel: string;
  /** True when the available history falls well short of the selected range — most often because the product is new or was recently restocked and just hasn't existed long enough to have that much price history, no matter how Rufus is asked. */
  isLimited: boolean;
};

/** A response counts as "limited" once it falls below this fraction of the selected range's target - a little slack so normal count variance (Rufus rounding, a missing/"null" entry) doesn't false-positive. */
const COVERAGE_SHORTFALL_RATIO = 0.8;

function buildCoverage(
  totalPoints: number,
  targetCount: number,
  targetLabel: string,
  unit: PriceHistoryCoverage["unit"]
): PriceHistoryCoverage {
  return {
    availableCount: totalPoints,
    unit,
    targetLabel,
    isLimited: totalPoints < targetCount * COVERAGE_SHORTFALL_RATIO
  };
}

/** Cross-checks how many days of history actually came back against what the selected daily tab nominally represents, so the UI can flag products that simply haven't been tracked that long yet. */
export function getRangeCoverage(totalPoints: number, range: DailyPriceHistoryRange): PriceHistoryCoverage {
  return buildCoverage(totalPoints, RANGE_TARGET_DAYS[range], RANGE_LABEL[range], "day");
}

/** Same idea as `getRangeCoverage`, but for the separate weekly 1-year fetch. */
export function getYearlyCoverage(totalPoints: number): PriceHistoryCoverage {
  return buildCoverage(totalPoints, YEARLY_TARGET_WEEKS, RANGE_LABEL["1y"], "week");
}

/** Pros/cons fetched from Rufus on a separate, on-demand prompt (see `loadProsCons`). */
export type ProsConsResult = {
  pros: string[];
  cons: string[];
  fetchedAt: number;
};

// All Amazon assistant (Rufus) selectors and prompts live in config; reading
// them through this single accessor keeps a markup change to one JSON file.
function getAssistant() {
  return getConfig().amazon.assistant;
}

/**
 * A real month name/abbreviation ("Mar", "March"), never a generic word.
 * Used instead of `[A-Za-z]+` wherever a date gets matched out of free-form
 * prose (as opposed to an already-isolated header token) - otherwise a
 * phrase like "the last 3 months: 27 Mar: ₹618" can itself look like a date
 * ("3 months"), consuming the digits that belong to the *real* following
 * entry and silently dropping it.
 */
const MONTH_TOKEN_SOURCE = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*";
// The trailing year is optional and only shows up once a range crosses a
// calendar year - the weekly 1-year prompt's response puts one on every
// single entry ("24 Jun 2025: ₹69,790"), not just at a boundary.
const DATE_WORD_SOURCE = `\\d{1,2}\\s+${MONTH_TOKEN_SOURCE}(?:\\s+\\d{4})?`;

/** "14 May - ₹1,155" / "14 may - 128" — date label, then a price with an optional ₹ and thousands separators. */
const PRICE_ENTRY_PATTERN = new RegExp(`(${DATE_WORD_SOURCE})\\s*-\\s*₹?\\s*([\\d,]+(?:\\.\\d+)?)`, "gi");

const SUBMIT_DELAY_MS = 1000;
// 3 months of daily prices (or a year of weekly prices) is a longer answer
// than the original 1-month prompt, so Rufus needs more room to stream it.
const RESPONSE_TIMEOUT_MS = 80000;
/**
 * Minimum daily entries for a response to count as a real price-history list
 * (vs. a stray "X - Y" in a summary sentence). Deliberately a low *floor*, not
 * the full ~180-day target — Rufus may not have that much real history for a
 * given product and will return fewer days; the true "done" signal is the
 * response going stable (`STABLE_DELAY_MS`), not hitting a fixed count.
 * Tunable in default-config.json.
 */
const MIN_EXPECTED_POINTS = () => getConfig().thresholds.priceHistoryMinPoints;
/** Same idea as `MIN_EXPECTED_POINTS`, but for the separate weekly 1-year fetch (a much lower floor since a full year is only ~52 entries). */
const MIN_EXPECTED_YEARLY_POINTS = () => getConfig().thresholds.priceHistoryYearlyMinPoints;
/** How long the response must stop growing before we treat the streamed answer as complete. */
const STABLE_DELAY_MS = 1500;
/**
 * How often we poll the DOM for the streamed response. Polling (instead of a
 * MutationObserver on document.body) is deliberate: while Rufus streams, the
 * page emits a flood of character-data mutations that would otherwise saturate
 * the shared main thread and freeze both the page and our overlay. A fixed
 * low-frequency poll does a bounded amount of work no matter how fast it streams.
 */
const POLL_INTERVAL_MS = 800;
/** Grace period before the first poll — the assistant always takes a few seconds to start answering, so there's nothing to read before this. */
const INITIAL_POLL_DELAY_MS = 12000;
/**
 * If the response stops growing for this long while we still have too few points,
 * assume hiding Rufus's output (see `suppressRendering`) stalled its streaming
 * and un-hide it so it can finish. A safety net — content-visibility shouldn't
 * affect DOM mutation, but Amazon's widget behaviour can change.
 */
const STALL_RESTORE_MS = 3000;

const CACHE_PREFIX = "shopiq:price-history:";
const YEARLY_CACHE_PREFIX = "shopiq:price-history-yearly:";
const PROS_CONS_CACHE_PREFIX = "shopiq:pros-cons:";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
/** Longer than the daily cache - the 1-year fetch is heavier and user-triggered, and weekly history a year back doesn't change moment to moment. */
const YEARLY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Title-cases "14 may" -> "14 May" for display. */
function normalizeLabel(label: string): string {
  const [day, month] = label.trim().split(/\s+/);
  if (!month) return label.trim();
  return `${day} ${month.charAt(0).toUpperCase()}${month.slice(1).toLowerCase()}`;
}

/** Extracts "DD Month - price" pairs from free-form assistant text. */
export function parsePriceHistoryText(text: string): PricePoint[] {
  const points: PricePoint[] = [];

  for (const match of text.matchAll(PRICE_ENTRY_PATTERN)) {
    const price = Number(match[2].replace(/,/g, ""));
    if (Number.isFinite(price)) {
      points.push({ label: normalizeLabel(match[1]), price });
    }
  }

  return points;
}

const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december"
];

/**
 * "25April" / "26Dec2025" -> { day, month (zero-based), year? }. `undefined`
 * if the month name isn't recognized. The year is only present once the
 * range spans a calendar-year boundary (e.g. the 1-year weekly window) - and when
 * it is, Amazon also switches to a 3-letter month abbreviation ("Dec") rather
 * than the full name used in the no-year case ("April"), so this matches by
 * prefix rather than requiring an exact name (every month's first 3 letters
 * are unique, so this is unambiguous either way).
 */
function parseDayMonth(label: string): { day: number; month: number; year?: number } | undefined {
  const match = label.trim().match(/(\d{1,2})\s*([A-Za-z]+)\s*(\d{4})?/);
  if (!match) return undefined;
  const monthToken = match[2].toLowerCase();
  const month = MONTH_NAMES.findIndex((name) => name.startsWith(monthToken));
  if (month === -1) return undefined;
  return { day: Number(match[1]), month, year: match[3] ? Number(match[3]) : undefined };
}

/** Resolves a day/month(/year) to an absolute date. When no year is given (the range didn't cross a year boundary), anchors to the most recent past occurrence — Amazon's range header omits the year in that case. */
function resolveStartDate(day: number, month: number, year?: number, reference = new Date()): Date {
  if (year !== undefined) return new Date(year, month, day);

  const date = new Date(reference.getFullYear(), month, day);
  if (date.getTime() > reference.getTime()) date.setFullYear(date.getFullYear() - 1);
  return date;
}

function formatDateLabel(date: Date): string {
  const month = MONTH_NAMES[date.getMonth()];
  return `${date.getDate()} ${month.charAt(0).toUpperCase()}${month.slice(1)}`;
}

/**
 * "Date - 26Dec2025-23Jun2026 | Price - ₹5998,₹5998,..." — a date-range
 * header followed by one price per day, oldest first. This was an earlier
 * prompt's requested format and is now kept only as a fallback - the current
 * prompt instead asks for the natural "DD Mon: ₹price" notation handled by
 * `parsePricePatternText`, since Rufus tends to refuse an overly symbolic
 * format request as if it were being asked to reveal internal data
 * structures. The trailing year on each date is optional and only shows up
 * once the range crosses a calendar year. Amazon doesn't keep this format
 * consistent: the label separator has shown up as both "-" and ":" ("date
 * -" / "Date:"), and the range separator as both "-" and the word "to"
 * ("25April-23June" / "26 December 2025 to 23 June 2026") - both are
 * accepted here.
 */
// Zero-or-more whitespace (not `DATE_WORD_SOURCE`'s one-or-more) since this
// header has shown up both with a space ("26 December") and without ("26Dec").
const DATE_TOKEN_SOURCE = `\\d{1,2}\\s*${MONTH_TOKEN_SOURCE}\\s*(?:\\d{4})?`;
const RANGE_HEADER_PATTERN = new RegExp(
  `date\\s*[:-]\\s*(${DATE_TOKEN_SOURCE})\\s*(?:-|to)\\s*${DATE_TOKEN_SOURCE}`,
  "i"
);
const PRICE_LABEL_PATTERN = /price\s*[:-]/i;

/**
 * Splits the price section into per-entry tokens (a price, or `undefined`
 * for a "null" gap) using "^" as the entry separator - the current prompt's
 * format. Once "^" (not comma) is the separator, a price's own internal
 * thousands-grouping comma ("5,499") can never be confused with the
 * boundary between entries, so this is just a plain split with no need for
 * the comma-ambiguity handling `parsePriceTokens` below has to do.
 */
function splitOnCaret(priceSection: string): (number | undefined)[] {
  // No "^" at all means this isn't actually caret-formatted (e.g. Rufus fell
  // back to an older comma-based response) - without this guard, the whole
  // section would be treated as one token and its internal commas stripped
  // into one huge bogus number, instead of correctly yielding no match here
  // so the caller falls through to the comma-based parser.
  if (!priceSection.includes("^")) return [];

  return priceSection.split("^").map((token) => {
    const trimmed = token.trim();
    if (/^null/i.test(trimmed)) return undefined;
    const match = trimmed.match(/(\d[\d,]*(?:\.\d+)?)/);
    if (!match) return undefined;
    const price = Number(match[1].replace(/,/g, ""));
    return Number.isFinite(price) ? price : undefined;
  });
}

/**
 * Splits the price section into per-day tokens (a price, or `undefined` for
 * a "null" gap day). Amazon writes this in two genuinely different layouts:
 *
 *  - One "₹" per entry, e.g. "₹5918,₹5918,...,null,₹5918": entries are
 *    plain digits with no thousands grouping, so a straight comma-split
 *    (each piece optionally "₹"-prefixed) is unambiguous.
 *  - A single "₹" for the whole list, e.g. "₹5,499,5,499,5,499,...": with no
 *    per-entry marker, Amazon thousands-groups each number ("5,499") so the
 *    boundary between entries is still recoverable from standard
 *    number-grouping rules. A plain comma-split would instead shatter
 *    "5,499,5,499" into ["5","499","5","499"].
 *
 * Which layout is in play is detected from how many "₹" the section has.
 */
function parsePriceTokens(priceSection: string): (number | undefined)[] {
  const rupeeCount = (priceSection.match(/₹/g) ?? []).length;
  return rupeeCount > 1 ? splitOnDelimitedEntries(priceSection) : splitOnGroupedNumbers(priceSection);
}

const DELIMITED_ENTRY_PATTERN = /^₹?\s*([\d,]+(?:\.\d+)?)$/;

function splitOnDelimitedEntries(priceSection: string): (number | undefined)[] {
  return priceSection.split(",").map((token) => {
    const trimmed = token.trim();
    if (/^null$/i.test(trimmed)) return undefined;
    const match = trimmed.match(DELIMITED_ENTRY_PATTERN);
    if (!match) return undefined;
    const price = Number(match[1].replace(/,/g, ""));
    return Number.isFinite(price) ? price : undefined;
  });
}

/**
 * Matches one grouped number (`\d{1,3}` then zero or more `,\d{3}`
 * continuations) or a "null" gap. A list-separator comma is never followed
 * by a 3-digit group AND another comma right after it, so this correctly
 * stops at the boundary between entries rather than merging "5,499,5,499"
 * into one number.
 */
const GROUPED_NUMBER_PATTERN = /\d{1,3}(?:,\d{3})*(?:\.\d+)?|null/gi;

function splitOnGroupedNumbers(priceSection: string): (number | undefined)[] {
  return Array.from(priceSection.matchAll(GROUPED_NUMBER_PATTERN)).map((match) => {
    const token = match[0];
    if (/^null$/i.test(token)) return undefined;
    const price = Number(token.replace(/,/g, ""));
    return Number.isFinite(price) ? price : undefined;
  });
}

/**
 * Shared by both range-header parsers: finds the "date - X to Y | price -
 * ..." header, tokenizes the price section with whichever `tokenize`
 * function matches the prompt's separator, then expands each non-gap token
 * into a `PricePoint` `stepDays` apart (1 for the daily prompt, 7 for the
 * weekly 1-year prompt) starting from the header's start date.
 */
function parseRangeHeaderAndPrices(
  text: string,
  tokenize: (priceSection: string) => (number | undefined)[],
  stepDays: number
): PricePoint[] {
  const headerMatch = text.match(RANGE_HEADER_PATTERN);
  if (!headerMatch) return [];

  const start = parseDayMonth(headerMatch[1]);
  if (!start) return [];

  const priceLabelMatch = text.match(PRICE_LABEL_PATTERN);
  if (!priceLabelMatch) return [];

  const priceSection = text.slice(priceLabelMatch.index! + priceLabelMatch[0].length);
  // Every matched slot (including "null" gaps) advances the date index, so a
  // gap doesn't shift every later date out of alignment.
  const tokens = tokenize(priceSection);
  if (tokens.every((price) => price === undefined)) return [];

  const startDate = resolveStartDate(start.day, start.month, start.year);
  const points: PricePoint[] = [];
  tokens.forEach((price, index) => {
    if (price === undefined) return;
    const date = new Date(startDate);
    date.setDate(date.getDate() + index * stepDays);
    points.push({ label: formatDateLabel(date), price });
  });
  return points;
}

/** Extracts points from the "^"-separated range format (the current prompt). Returns `[]` (never throws) when the text doesn't match, so callers can fall back to older formats. */
export function parseCaretSeparatedRangeText(text: string, stepDays = 1): PricePoint[] {
  return parseRangeHeaderAndPrices(text, splitOnCaret, stepDays);
}

/** Extracts points from the older comma-separated range format, kept as a fallback since Amazon hasn't reliably stuck to one format. Returns `[]` (never throws) when the text doesn't match. */
export function parsePriceHistoryRangeText(text: string, stepDays = 1): PricePoint[] {
  return parseRangeHeaderAndPrices(text, parsePriceTokens, stepDays);
}

/**
 * Extracts points from a "Price Pattern" style list, where Rufus summarizes
 * a run of unchanged days into one line instead of expanding every day, e.g.:
 *   26 Dec-14 Jan: ₹930
 *   1 Feb: ₹1,099 (highest price - single day spike)
 *   18 May-23 Jun: ₹999 (current price)
 * Each line becomes one point per day in its range (same price for every
 * day in that run); a single-day line (no "-end") becomes just that one
 * point. Trailing parentheticals like "(current price)" are ignored - the
 * price capture stops at the first non-digit/comma character.
 */
const PRICE_PATTERN_LINE = new RegExp(
  `(${DATE_WORD_SOURCE})\\s*(?:-\\s*(${DATE_WORD_SOURCE}))?\\s*:\\s*₹?\\s*([\\d,]+(?:\\.\\d+)?)`,
  "gi"
);
/** Hard cap on how many days a single line can expand to, so a malformed date pair can't spin the loop out needlessly. */
const PRICE_PATTERN_MAX_RUN_DAYS = 400;

export function parsePricePatternText(text: string): PricePoint[] {
  const points: PricePoint[] = [];

  for (const match of text.matchAll(PRICE_PATTERN_LINE)) {
    const start = parseDayMonth(match[1]);
    if (!start) continue;
    const price = Number(match[3].replace(/,/g, ""));
    if (!Number.isFinite(price)) continue;

    const startDate = resolveStartDate(start.day, start.month, start.year);
    const end = match[2] ? parseDayMonth(match[2]) : undefined;
    const endDate = end ? resolveStartDate(end.day, end.month, end.year) : startDate;
    if (endDate.getTime() < startDate.getTime()) continue;

    const cursor = new Date(startDate);
    for (let day = 0; day <= PRICE_PATTERN_MAX_RUN_DAYS && cursor.getTime() <= endDate.getTime(); day += 1) {
      points.push({ label: formatDateLabel(cursor), price });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return points;
}

/**
 * Tries the "Price Pattern" run-length list first - the current prompt's
 * format, e.g. "27 Mar: ₹618, 28 Mar: ₹618" or "26 Dec-14 Jan: ₹930" - then
 * two older, more symbolic formats kept only as fallbacks (a "^"-separated
 * list, then a comma-separated "Date - X to Y | Price - ..." header), and
 * finally the oldest per-day pairs. The run-length list must come before
 * the oldest per-day-pairs parser specifically: a line like "26 Dec-14 Jan:
 * ₹930" would otherwise get misread by that parser as "26 Dec - [price] 14".
 */
function parsePriceHistoryParagraph(text: string, stepDays = 1): PricePoint[] {
  const patternList = parsePricePatternText(text);
  if (patternList.length > 0) return patternList;

  const caretBased = parseCaretSeparatedRangeText(text, stepDays);
  if (caretBased.length > 0) return caretBased;

  const commaBased = parsePriceHistoryRangeText(text, stepDays);
  if (commaBased.length > 0) return commaBased;

  return parsePriceHistoryText(text);
}

/** Picks the paragraph with the most date/price matches, so summary sentences (which can contain stray "X - Y" pairs) don't win. `stepDays` is 1 for the daily prompt, 7 for the weekly 1-year prompt. */
function extractPricePoints(response: Element, stepDays = 1): PricePoint[] {
  const paragraphs = response.querySelectorAll(getAssistant().paragraphSelector);
  let best: PricePoint[] = [];

  paragraphs.forEach((paragraph) => {
    const points = parsePriceHistoryParagraph(paragraph.textContent ?? "", stepDays);
    if (points.length > best.length) best = points;
  });

  if (best.length === 0) {
    best = parsePriceHistoryParagraph(response.textContent ?? "", stepDays);
  }

  return best;
}

/** Finds the `<ul class="rufus-dpx-markdown-list-block">` immediately following a paragraph matching `labelPattern` (e.g. "3 Pros:") and returns its list items. */
function extractListAfterLabel(response: Element, labelPattern: RegExp): string[] {
  const { paragraphSelector, listBlockSelector } = getAssistant();
  const paragraphs = response.querySelectorAll(paragraphSelector);

  for (const paragraph of paragraphs) {
    if (!labelPattern.test(paragraph.textContent ?? "")) continue;

    let sibling = paragraph.nextElementSibling;
    while (sibling && !sibling.matches(listBlockSelector)) {
      sibling = sibling.nextElementSibling;
    }
    if (!sibling) continue;

    return Array.from(sibling.querySelectorAll("li"))
      .map((item) => item.textContent?.trim() ?? "")
      .filter(Boolean);
  }

  return [];
}

/** Extracts the "3 Pros:" / "3 Cons:" list items from the assistant's response, if present. */
function extractProsAndCons(response: Element): { pros: string[]; cons: string[] } {
  return {
    pros: extractListAfterLabel(response, /pros/i),
    cons: extractListAfterLabel(response, /cons/i)
  };
}

export type PriceAlertTone = "low" | "high" | "same";

export type PriceAlert = {
  tone: PriceAlertTone;
  message: string;
  /** Optional factual note on how the price has moved over the last week compared to the week before — past only, never a prediction. */
  detail?: string;
};

/** How far the current price must sit from the window's average (as a fraction) before it's called out as notably high/low. */
const PRICE_ALERT_THRESHOLD = 0.03;

/** Number of (most recent) daily points considered "this week" when computing the weekly change. */
const WEEK_WINDOW_DAYS = 7;
/** How far this week's average must differ from the prior week's (as a fraction) before it's worth mentioning. A looser bar than `PRICE_ALERT_THRESHOLD` since week-over-week swings are naturally smaller. */
const WEEKLY_CHANGE_THRESHOLD = 0.02;

function average(points: PricePoint[]): number {
  return points.reduce((sum, point) => sum + point.price, 0) / points.length;
}

/** Compares this week's average price to the week before it. `null` if there isn't two full weeks of data. */
function computeWeeklyChangePercent(points: PricePoint[]): number | null {
  if (points.length < WEEK_WINDOW_DAYS * 2) return null;

  const thisWeek = average(points.slice(-WEEK_WINDOW_DAYS));
  const lastWeek = average(points.slice(-WEEK_WINDOW_DAYS * 2, -WEEK_WINDOW_DAYS));
  return Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
}

/** A factual note on how this week's average price compares to last week's, if the difference is big enough to mention. */
function weeklyChangeDetail(weeklyChangePercent: number | null): string | undefined {
  if (weeklyChangePercent === null) return undefined;
  if (weeklyChangePercent <= -WEEKLY_CHANGE_THRESHOLD * 100)
    return `Down ${Math.abs(weeklyChangePercent)}% from last week`;
  if (weeklyChangePercent >= WEEKLY_CHANGE_THRESHOLD * 100)
    return `Up ${weeklyChangePercent}% from last week`;
  return undefined;
}

/** Summarizes how today's price compares to its recent range, for the price alert badge and the price history insight. Facts only - past and current prices, no predictions about what happens next. */
export function getPriceAlert(stats: PriceHistoryStats): PriceAlert {
  const { current, lowest, highest, average, weeklyChangePercent, windowDays } = stats;
  const detail = weeklyChangeDetail(weeklyChangePercent);

  // No variation at all over the window - "current == lowest == highest" would
  // otherwise read as "Lowest in N days", which is misleading when the price
  // has simply never moved.
  if (lowest.price === highest.price) {
    return { tone: "same", message: `Price hasn't changed in ${windowDays} days` };
  }

  const diffPercent = Math.round(((current.price - average) / average) * 100);

  if (current.price <= lowest.price) {
    return { tone: "low", message: `Lowest in ${windowDays} days — grab the deal!`, detail };
  }
  if (current.price >= highest.price) {
    return { tone: "high", message: `Highest in ${windowDays} days — overpriced`, detail };
  }
  if (diffPercent <= -PRICE_ALERT_THRESHOLD * 100) {
    return { tone: "low", message: `${Math.abs(diffPercent)}% lower — good time to buy`, detail };
  }
  if (diffPercent >= PRICE_ALERT_THRESHOLD * 100) {
    return { tone: "high", message: `${diffPercent}% higher — bad time to buy`, detail };
  }
  return { tone: "same", message: "Typical price right now", detail };
}

/** Computes lowest/highest/current/average/weekly-change from a parsed price series. */
export function computePriceHistoryStats(points: PricePoint[]): PriceHistoryStats {
  let lowest = points[0];
  let highest = points[0];
  let sum = 0;

  for (const point of points) {
    if (point.price < lowest.price) lowest = point;
    if (point.price > highest.price) highest = point;
    sum += point.price;
  }

  return {
    lowest,
    highest,
    current: points[points.length - 1],
    average: sum / points.length,
    weeklyChangePercent: computeWeeklyChangePercent(points),
    windowDays: points.length
  };
}

/**
 * Captures the current scroll position and returns a function that, when
 * called, snaps back to it if it has drifted. Each call is a single,
 * one-shot check - not a recurring poll or a persistent `scroll` listener -
 * so this can never turn into an ongoing fight with the user's own
 * scrolling: call it a few times right around when Amazon is likely to
 * auto-scroll, then stop entirely and leave the user free to scroll however
 * they like for the rest of the request. Jumps instantly
 * (`behavior: "instant"`) rather than letting the page's own CSS animate the
 * correction.
 */
function lockPageScroll(): () => void {
  const x = window.scrollX;
  const y = window.scrollY;

  return () => {
    if (window.scrollX !== x || window.scrollY !== y) {
      window.scrollTo({ left: x, top: y, behavior: "instant" });
    }
  };
}

/** Delays (ms) at which to make a single check-and-correct call to `restore`, counted from right after submitting - Amazon scrolls the Rufus panel into view shortly after the click. A short, fixed, one-shot burst, not a recurring timer. */
const SCROLL_RESTORE_DELAYS_MS = [0, 150, 400, 900];

function scheduleScrollRestoreBurst(restore: () => void): void {
  for (const delay of SCROLL_RESTORE_DELAYS_MS) {
    window.setTimeout(restore, delay);
  }
}

function findAssistantControls(): { input: HTMLInputElement; button: HTMLElement } | undefined {
  const { searchInputId, submitButtonId } = getAssistant();
  const input = document.getElementById(searchInputId);
  const button = document.getElementById(submitButtonId);
  if (!(input instanceof HTMLInputElement) || !button) return undefined;
  return { input, button };
}

/**
 * Sets an input's value through React's native value setter so a controlled
 * component actually registers the change (a plain `input.value = …` is silently
 * reverted by React on the next render).
 */
function setReactInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Rufus sometimes pre-fills its search box (a suggested prompt). New text can't
 * be entered until that's cleared, so click Amazon's own clear button when it's
 * present and otherwise blank the field via the React setter.
 */
function clearAssistantInput(input: HTMLInputElement): void {
  if (!input.value) return;
  const clearButton = document.querySelector<HTMLElement>(getAssistant().clearButtonSelector);
  if (clearButton) {
    clearButton.click();
    if (input.value) setReactInputValue(input, "");
  } else {
    setReactInputValue(input, "");
  }
}

/**
 * Stops the browser from laying out & painting Rufus's streamed markdown while
 * we read it. We never need to *see* Rufus (the data is rendered in our own
 * overlay), and `content-visibility: hidden` skips rendering its contents
 * entirely while leaving the DOM — so `textContent`/`querySelectorAll` still
 * work — which removes the per-token layout/paint that competes with the
 * overlay for the main thread.
 */
function suppressRendering(el: HTMLElement): void {
  el.style.setProperty("content-visibility", "hidden", "important");
  el.style.setProperty("contain-intrinsic-size", "0 1px", "important");
}

function restoreRendering(el: HTMLElement): void {
  el.style.removeProperty("content-visibility");
  el.style.removeProperty("contain-intrinsic-size");
}

/**
 * Waits for a new assistant response to appear and finish streaming: once it
 * has at least `MIN_EXPECTED_POINTS` parsed entries, waits `STABLE_DELAY_MS`
 * of no further DOM changes before resolving. Falls back to whatever was
 * parsed so far if `RESPONSE_TIMEOUT_MS` elapses first.
 *
 * While streaming, the response element is rendering-suppressed (see
 * `suppressRendering`) and we poll on `requestIdleCallback` so Rufus's own work
 * gets the main thread first; both keep the overlay responsive.
 */
function waitForAssistantResponse<T>(
  existing: Set<Element>,
  parse: (response: HTMLElement) => T,
  hasEnough: (parsed: T) => boolean,
  restoreScroll: () => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    // Tracks the last observed "size" of the response so we can tell when it has
    // stopped growing (streaming finished) without listening to DOM mutations.
    let lastLength = -1;
    let lastChangeAt = Date.now();
    let stopped = false;
    let suppressed: HTMLElement | null = null;
    let restoredFallback = false;

    // Identify the answer by element identity, not by count: find the newest
    // response element that wasn't present when we submitted. This is robust to
    // a leftover answer from a prior attempt — whether Rufus appends a new
    // bubble or replaces the old one, the new element won't be in `existing`.
    const getNewResponse = (): HTMLElement | undefined => {
      const responses = document.querySelectorAll<HTMLElement>(getAssistant().responseSelector);
      for (let i = responses.length - 1; i >= 0; i -= 1) {
        if (!existing.has(responses[i])) return responses[i];
      }
      return undefined;
    };

    const settle = (run: () => void) => {
      stopped = true;
      if (suppressed) restoreRendering(suppressed);
      run();
    };

    const poll = () => {
      if (stopped) return;
      const response = getNewResponse();

      if (response) {
        // #1 — suppress Rufus's streaming paint as soon as the response appears.
        if (response !== suppressed) {
          suppressed = response;
          suppressRendering(response);
          // Amazon also tends to scroll the page when the response bubble
          // first appears, however long that took. One single correction
          // right now, then we never touch scroll again for this request.
          restoreScroll();
        }

        const parsed = parse(response);
        const enough = hasEnough(parsed);
        const length = response.textContent?.length ?? 0;
        if (length !== lastLength) {
          lastLength = length;
          lastChangeAt = Date.now();
        }

        // Safety net: if hiding seems to have stalled streaming before we have
        // enough data, un-hide it and give it another window to grow.
        if (!restoredFallback && !enough && Date.now() - lastChangeAt >= STALL_RESTORE_MS) {
          restoredFallback = true;
          restoreRendering(response);
          suppressed = null;
          lastChangeAt = Date.now();
        }

        if (enough && Date.now() - lastChangeAt >= STABLE_DELAY_MS) {
          settle(() => resolve(parsed));
          return;
        }
      }

      if (Date.now() - startTime >= RESPONSE_TIMEOUT_MS) {
        const parsed = response ? parse(response) : undefined;
        settle(() => {
          if (parsed !== undefined && hasEnough(parsed)) {
            resolve(parsed);
          } else {
            reject(new Error("Amazon's AI assistant didn't respond in time. Please try again."));
          }
        });
        return;
      }

      schedule();
    };

    // #2 — yield to Rufus: run the next poll when the main thread is idle (or
    // after POLL_INTERVAL_MS at the latest, so we never stall indefinitely).
    const schedule = () => {
      if (stopped) return;
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(() => poll(), { timeout: POLL_INTERVAL_MS });
      } else {
        window.setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    // Wait out the assistant's initial "thinking" time before the first poll.
    window.setTimeout(poll, INITIAL_POLL_DELAY_MS);
  });
}

// Rufus has a single shared input, so only one prompt can run at a time. This
// chain serializes assistant prompts (e.g. price history, then pros/cons),
// regardless of whether the previous one resolved or failed.
let assistantLock: Promise<unknown> = Promise.resolve();

/**
 * Submits one prompt to Rufus and waits for its answer, parsed by `parse` and
 * considered complete once `hasEnough` is true. Serialized against any other
 * in-flight assistant prompt so two prompts never fight over the input.
 */
function runAssistantPrompt<T>(
  prompt: string,
  parse: (response: HTMLElement) => T,
  hasEnough: (parsed: T) => boolean
): Promise<T> {
  const task = async (): Promise<T> => {
    const controls = findAssistantControls();
    if (!controls) {
      throw new Error("Sign in to view price history");
    }

    const { input, button } = controls;
    const existingResponses = new Set<Element>(document.querySelectorAll(getAssistant().responseSelector));

    // Captured before any interaction with Rufus's own DOM - on a second or
    // third prompt (pros/cons, the 1-year fetch), `clearAssistantInput`
    // below clicks Amazon's own "clear" button (the first prompt's input is
    // empty, so it no-ops there), which can itself trigger Amazon's
    // scroll-into-view. Capturing the position any later would lock onto
    // wherever that jump already landed, instead of the user's real
    // original position.
    const restoreScroll = lockPageScroll();
    scheduleScrollRestoreBurst(restoreScroll);

    // Rufus may still hold the previous prompt's text; clear it before entering ours.
    clearAssistantInput(input);
    // preventScroll: focusing the Rufus input would otherwise scroll the page
    // down to it — the bug where the page jumps to the AI section on submit.
    input.focus({ preventScroll: true });
    setReactInputValue(input, prompt);

    await new Promise((resolve) => window.setTimeout(resolve, SUBMIT_DELAY_MS));
    scheduleScrollRestoreBurst(restoreScroll);
    button.click();

    return waitForAssistantResponse(existingResponses, parse, hasEnough, restoreScroll);
  };

  const run = assistantLock.then(task, task);
  // Keep the chain alive even if this run rejects, so the next prompt still runs.
  assistantLock = run.catch(() => undefined);
  return run;
}

/**
 * Drops points whose price is wildly inconsistent with the product's
 * currently known price - almost certainly a parsing artifact (e.g. a
 * mis-handled comma in a 5-digit price like "43,500") rather than a price
 * the product was ever genuinely listed at. Same min/max ratio already used
 * to sanity-check retailer price-comparison matches elsewhere in the
 * extension (`background/scraping/pricing/service.ts`). Skipped entirely
 * when the current price isn't known.
 */
const PRICE_SANITY_MIN_RATIO = 0.2;
const PRICE_SANITY_MAX_RATIO = 5;

export function filterImplausiblePoints(points: PricePoint[], referencePrice?: number): PricePoint[] {
  if (!referencePrice || referencePrice <= 0) return points;
  const min = referencePrice * PRICE_SANITY_MIN_RATIO;
  const max = referencePrice * PRICE_SANITY_MAX_RATIO;
  return points.filter((point) => point.price >= min && point.price <= max);
}

/** Submits the price-history prompt to Rufus and returns the parsed history, dropping any point that's implausible against `referencePrice` (the product's current price, read straight off the page). */
async function requestPriceHistoryFromAssistant(referencePrice?: number): Promise<PriceHistoryData> {
  const rawPoints = await runAssistantPrompt(
    getAssistant().priceHistoryPrompt,
    (response) => extractPricePoints(response),
    (pts) => pts.length >= MIN_EXPECTED_POINTS()
  );
  const points = filterImplausiblePoints(rawPoints, referencePrice);

  if (points.length === 0) {
    throw new Error("Couldn't read price history from Amazon's AI response.");
  }

  return { points, stats: computePriceHistoryStats(points), fetchedAt: Date.now() };
}

/** Submits the separate, on-demand 1-year prompt to Rufus (each week's lowest price, stepDays=7) and returns the parsed history, same sanity filter as the daily fetch. Only ever called when the user opens the 1-year tab - never auto-fetched. */
async function requestYearlyPriceHistoryFromAssistant(referencePrice?: number): Promise<PriceHistoryData> {
  const rawPoints = await runAssistantPrompt(
    getAssistant().priceHistoryYearlyPrompt,
    (response) => extractPricePoints(response, 7),
    (pts) => pts.length >= MIN_EXPECTED_YEARLY_POINTS()
  );
  const points = filterImplausiblePoints(rawPoints, referencePrice);

  if (points.length === 0) {
    throw new Error("Couldn't read 1-year price history from Amazon's AI response.");
  }

  return { points, stats: computePriceHistoryStats(points), fetchedAt: Date.now() };
}

/** Submits the pros/cons prompt to Rufus and returns the parsed lists. */
async function requestProsConsFromAssistant(): Promise<ProsConsResult> {
  const { pros, cons } = await runAssistantPrompt(
    getAssistant().prosConsPrompt,
    extractProsAndCons,
    (pc) => pc.pros.length > 0 && pc.cons.length > 0
  );

  if (pros.length === 0 && cons.length === 0) {
    throw new Error("Couldn't read pros & cons from Amazon's AI response.");
  }

  return { pros, cons, fetchedAt: Date.now() };
}

/** Stable per-product cache key, preferring the ASIN over the full URL. */
export function getPriceHistoryCacheKey(product: ProductData): string {
  return CACHE_PREFIX + (product.asin ?? product.url);
}

/** Stable per-product cache key for the separate 1-year fetch. */
export function getYearlyPriceHistoryCacheKey(product: ProductData): string {
  return YEARLY_CACHE_PREFIX + (product.asin ?? product.url);
}

async function getCachedResult<T extends { fetchedAt: number }>(key: string, ttlMs: number): Promise<T | undefined> {
  const stored = await chrome.storage.local.get(key);
  const cached = stored[key] as T | undefined;
  if (!cached || Date.now() - cached.fetchedAt > ttlMs) return undefined;
  return cached;
}

/**
 * Cache-first, in-flight-deduped loader shared by price history, the yearly
 * fetch, and pros/cons (each with its own TTL). A forced refresh ignores both
 * the cache and any in-flight request and always starts fresh — otherwise a
 * retry would just re-attach to the request that's already failing/hung.
 */
async function loadCachedAssistantResult<T extends { fetchedAt: number }>(
  key: string,
  pending: Map<string, Promise<T>>,
  request: () => Promise<T>,
  forceRefresh: boolean,
  ttlMs: number
): Promise<T> {
  if (!forceRefresh) {
    const cached = await getCachedResult<T>(key, ttlMs);
    if (cached) return cached;

    const inFlight = pending.get(key);
    if (inFlight) return inFlight;
  }

  const run = request()
    .then(async (data) => {
      await chrome.storage.local.set({ [key]: data });
      return data;
    })
    .finally(() => {
      // Only clear if we're still the current request — a newer forced refresh
      // may have replaced us, and its entry must not be deleted by our finally.
      if (pending.get(key) === run) pending.delete(key);
    });

  pending.set(key, run);
  return run;
}

// Dedupes concurrent loads for the same product (e.g. if the tab is
// re-mounted while the assistant is still "thinking").
const pendingPriceHistory = new Map<string, Promise<PriceHistoryData>>();
const pendingYearlyPriceHistory = new Map<string, Promise<PriceHistoryData>>();
const pendingProsCons = new Map<string, Promise<ProsConsResult>>();

/** Returns cached price history for `product` when fresh, otherwise queries the AI assistant and caches the result. */
export function loadPriceHistory(product: ProductData, forceRefresh = false): Promise<PriceHistoryData> {
  const referencePrice = parseNumericValue(product.price);
  return loadCachedAssistantResult(
    getPriceHistoryCacheKey(product),
    pendingPriceHistory,
    () => requestPriceHistoryFromAssistant(referencePrice),
    forceRefresh,
    CACHE_TTL_MS
  );
}

/** Returns cached 1-year (weekly) price history for `product` when fresh, otherwise queries the AI assistant on demand. Never called automatically - only when the user opens the 1-year tab. */
export function loadYearlyPriceHistory(product: ProductData, forceRefresh = false): Promise<PriceHistoryData> {
  const referencePrice = parseNumericValue(product.price);
  return loadCachedAssistantResult(
    getYearlyPriceHistoryCacheKey(product),
    pendingYearlyPriceHistory,
    () => requestYearlyPriceHistoryFromAssistant(referencePrice),
    forceRefresh,
    YEARLY_CACHE_TTL_MS
  );
}

/** Stable per-product cache key for the pros/cons result. */
export function getProsConsCacheKey(product: ProductData): string {
  return PROS_CONS_CACHE_PREFIX + (product.asin ?? product.url);
}

/** Returns cached pros/cons for `product` when fresh, otherwise queries the AI assistant on demand. */
export function loadProsCons(product: ProductData, forceRefresh = false): Promise<ProsConsResult> {
  return loadCachedAssistantResult(
    getProsConsCacheKey(product),
    pendingProsCons,
    requestProsConsFromAssistant,
    forceRefresh,
    CACHE_TTL_MS
  );
}
