/** Real price history sourced by asking Amazon's on-page AI assistant (Rufus) and parsing its text response. */
import type { ProductData } from "../../shared/types";
import { getConfig } from "../../config";

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
};

export type PriceHistoryData = {
  points: PricePoint[];
  stats: PriceHistoryStats;
  fetchedAt: number;
};

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

/** "14 May - ₹1,155" / "14 may - 128" — date label, then a price with an optional ₹ and thousands separators. */
const PRICE_ENTRY_PATTERN = /(\d{1,2}\s+[A-Za-z]+)\s*-\s*₹?\s*([\d,]+(?:\.\d+)?)/g;

const SUBMIT_DELAY_MS = 1000;
const RESPONSE_TIMEOUT_MS = 60000;
/**
 * Minimum daily entries for a response to count as a real price-history list
 * (vs. a stray "X - Y" in a summary sentence). Deliberately a low *floor*, not a
 * full-month count — Rufus often returns fewer days (e.g. "past month" from the
 * 25th = ~25 entries); the true "done" signal is the response going stable
 * (`STABLE_DELAY_MS`), not hitting a fixed count. Tunable in default-config.json.
 */
const MIN_EXPECTED_POINTS = () => getConfig().thresholds.priceHistoryMinPoints;
/** How long the response must stop growing before we treat the streamed answer as complete. */
const STABLE_DELAY_MS = 1500;
/**
 * How often we poll the DOM for the streamed response. Polling (instead of a
 * MutationObserver on document.body) is deliberate: while Rufus streams, the
 * page emits a flood of character-data mutations that would otherwise saturate
 * the shared main thread and freeze both the page and our overlay. A fixed
 * low-frequency poll does a bounded amount of work no matter how fast it streams.
 */
const POLL_INTERVAL_MS = 500;
/** Grace period before the first poll — the assistant always takes a few seconds to start answering, so there's nothing to read before this. */
const INITIAL_POLL_DELAY_MS = 8000;
/**
 * If the response stops growing for this long while we still have too few points,
 * assume hiding Rufus's output (see `suppressRendering`) stalled its streaming
 * and un-hide it so it can finish. A safety net — content-visibility shouldn't
 * affect DOM mutation, but Amazon's widget behaviour can change.
 */
const STALL_RESTORE_MS = 3000;

const CACHE_PREFIX = "shopiq:price-history:";
const PROS_CONS_CACHE_PREFIX = "shopiq:pros-cons:";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

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

/** Picks the paragraph with the most date/price matches, so summary sentences (which can contain stray "X - Y" pairs) don't win. */
function extractPricePoints(response: Element): PricePoint[] {
  const paragraphs = response.querySelectorAll(getAssistant().paragraphSelector);
  let best: PricePoint[] = [];

  paragraphs.forEach((paragraph) => {
    const points = parsePriceHistoryText(paragraph.textContent ?? "");
    if (points.length > best.length) best = points;
  });

  if (best.length === 0) {
    best = parsePriceHistoryText(response.textContent ?? "");
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

/** How far the current price must sit from the 30-day average (as a fraction) before it's called out as notably high/low. */
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

/** Summarizes how today's price compares to its last-30-days range, for the price alert badge and the price history insight. Facts only - past and current prices, no predictions about what happens next. */
export function getPriceAlert(stats: PriceHistoryStats): PriceAlert {
  const { current, lowest, highest, average, weeklyChangePercent } = stats;
  const detail = weeklyChangeDetail(weeklyChangePercent);

  // No variation at all over the last 30 days - "current == lowest == highest"
  // would otherwise read as "Lowest in 30 days", which is misleading when the
  // price has simply never moved.
  if (lowest.price === highest.price) {
    return { tone: "same", message: "Price hasn't changed in 30 days" };
  }

  const diffPercent = Math.round(((current.price - average) / average) * 100);

  if (current.price <= lowest.price) {
    return { tone: "low", message: "Lowest in 30 days — grab the deal!", detail };
  }
  if (current.price >= highest.price) {
    return { tone: "high", message: "Highest in 30 days — overpriced", detail };
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
    weeklyChangePercent: computeWeeklyChangePercent(points)
  };
}

/** Delays (ms) at which to snap the page back to its scroll position after submitting (Amazon scrolls the Rufus panel into view shortly after). */
const SCROLL_RESTORE_DELAYS_MS = [0, 150, 500, 1200];

/**
 * Snaps the page back to its current scroll position a few times shortly
 * after submitting, undoing Amazon's auto-scroll to the Rufus panel. Unlike a
 * persistent scroll listener, this doesn't linger to fight with later
 * user-triggered scrolling.
 */
function lockPageScroll(): void {
  const x = window.scrollX;
  const y = window.scrollY;

  const restore = () => {
    if (window.scrollX !== x || window.scrollY !== y) {
      window.scrollTo(x, y);
    }
  };

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
  hasEnough: (parsed: T) => boolean
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

    // Rufus may still hold the previous prompt's text; clear it before entering ours.
    clearAssistantInput(input);
    // preventScroll: focusing the Rufus input would otherwise scroll the page
    // down to it — the bug where the page jumps to the AI section on submit.
    input.focus({ preventScroll: true });
    setReactInputValue(input, prompt);

    await new Promise((resolve) => window.setTimeout(resolve, SUBMIT_DELAY_MS));
    lockPageScroll();
    button.click();

    return waitForAssistantResponse(existingResponses, parse, hasEnough);
  };

  const run = assistantLock.then(task, task);
  // Keep the chain alive even if this run rejects, so the next prompt still runs.
  assistantLock = run.catch(() => undefined);
  return run;
}

/** Submits the price-history prompt to Rufus and returns the parsed history. */
async function requestPriceHistoryFromAssistant(): Promise<PriceHistoryData> {
  const points = await runAssistantPrompt(
    getAssistant().priceHistoryPrompt,
    extractPricePoints,
    (pts) => pts.length >= MIN_EXPECTED_POINTS()
  );

  if (points.length === 0) {
    throw new Error("Couldn't read price history from Amazon's AI response.");
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

async function getCachedResult<T extends { fetchedAt: number }>(key: string): Promise<T | undefined> {
  const stored = await chrome.storage.local.get(key);
  const cached = stored[key] as T | undefined;
  if (!cached || Date.now() - cached.fetchedAt > CACHE_TTL_MS) return undefined;
  return cached;
}

/**
 * Cache-first, in-flight-deduped loader shared by price history and pros/cons.
 * A forced refresh ignores both the cache and any in-flight request and always
 * starts fresh — otherwise a retry would just re-attach to the request that's
 * already failing/hung.
 */
async function loadCachedAssistantResult<T extends { fetchedAt: number }>(
  key: string,
  pending: Map<string, Promise<T>>,
  request: () => Promise<T>,
  forceRefresh: boolean
): Promise<T> {
  if (!forceRefresh) {
    const cached = await getCachedResult<T>(key);
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
const pendingProsCons = new Map<string, Promise<ProsConsResult>>();

/** Returns cached price history for `product` when fresh, otherwise queries the AI assistant and caches the result. */
export function loadPriceHistory(product: ProductData, forceRefresh = false): Promise<PriceHistoryData> {
  return loadCachedAssistantResult(
    getPriceHistoryCacheKey(product),
    pendingPriceHistory,
    requestPriceHistoryFromAssistant,
    forceRefresh
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
    forceRefresh
  );
}
