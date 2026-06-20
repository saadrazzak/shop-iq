/**
 * Seller scorecard, read from Amazon's seller profile (/sp) page. Because the
 * profile is same-origin with the product page, we `fetch()` it (with the user's
 * cookies) and parse the returned HTML in memory — no navigation or new tab.
 */
import type { ProductSeller, RatingBar, SellerFeedbackItem, SellerInfo, SellerRatingPeriod } from "../../shared/types";
import { getConfig } from "../../config";

const CACHE_PREFIX = "shopiq:seller:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_FEEDBACK_ITEMS = 8;

type RatingsState = Record<string, number>;

/** Reads an `<script type="a-state" data-a-state='{"key":...}'>` JSON blob by key. */
function readAState(doc: Document, key: string): RatingsState | undefined {
  for (const script of doc.querySelectorAll(getConfig().amazon.seller.selectors.stateScript)) {
    let meta: { key?: string };
    try {
      meta = JSON.parse(script.getAttribute("data-a-state") ?? "{}");
    } catch {
      continue;
    }
    if (meta.key !== key) continue;
    try {
      return JSON.parse(script.textContent ?? "") as RatingsState;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Builds a 5★→1★ percentage histogram from a ratings `a-state` blob. */
function histogramFromState(state: RatingsState): RatingBar[] {
  return [5, 4, 3, 2, 1].map((stars) => ({ stars, percent: Number(state[`star${stars}`]) || 0 }));
}

/** Weighted average from a percentage histogram (fallback when the DOM average is missing). */
function averageFromHistogram(histogram: RatingBar[]): number | undefined {
  const total = histogram.reduce((sum, bar) => sum + bar.percent, 0);
  if (total === 0) return undefined;
  const weighted = histogram.reduce((sum, bar) => sum + bar.stars * bar.percent, 0);
  return Math.round((weighted / total) * 10) / 10;
}

function parseNumber(text?: string | null): number | undefined {
  const cleaned = text?.replace(/[^\d.]/g, "");
  const value = cleaned ? Number(cleaned) : NaN;
  return Number.isFinite(value) ? value : undefined;
}

function parsePeriods(doc: Document): SellerRatingPeriod[] {
  const periods: SellerRatingPeriod[] = [];

  for (const source of getConfig().amazon.seller.periods) {
    const state = readAState(doc, source.stateKey);
    if (!state) continue;

    const histogram = histogramFromState(state);
    const domAverage = parseNumber(doc.getElementById(source.averageId)?.textContent);
    periods.push({
      period: source.period as SellerRatingPeriod["period"],
      average: domAverage ?? averageFromHistogram(histogram),
      ratingCount: Number(state.ratingCount) || undefined,
      histogram
    });
  }

  return periods;
}

/** "By Shyam mohan on 17 June, 2026." → { author, date }. */
function parseRater(raw?: string | null): { author?: string; date?: string } {
  const text = raw?.replace(/\s+/g, " ").trim();
  if (!text) return {};
  const match = text.match(/^By\s+(.+?)\s+on\s+(.+?)\.?$/i);
  if (!match) return { author: text.replace(/^By\s+/i, "").trim() || undefined };
  return { author: match[1].trim(), date: match[2].trim() };
}

function parseFeedback(doc: Document): SellerFeedbackItem[] {
  const sel = getConfig().amazon.seller.selectors;
  const rows = Array.from(doc.querySelectorAll(sel.feedbackRow)).filter(
    (row) => row.id !== sel.feedbackTemplateId && !row.classList.contains("hide-content")
  );

  const items: SellerFeedbackItem[] = [];
  for (const row of rows) {
    if (items.length >= MAX_FEEDBACK_ITEMS) break;

    const starClass = row.querySelector(sel.feedbackStars)?.className.match(/a-star-(\d)/);
    const stars = starClass ? Number(starClass[1]) : 0;

    const main = row.querySelector(sel.feedbackMain) ?? row;
    const rawText = main.querySelector(sel.feedbackText)?.textContent?.replace(/\s+/g, " ").trim();
    const text = rawText && rawText !== "null" && !rawText.startsWith("template-") ? rawText : "";

    const suppressed = main.querySelector<HTMLElement>(sel.feedbackSuppressed);
    const suppressedVisible = suppressed ? !/display:\s*none/i.test(suppressed.getAttribute("style") ?? "") : false;
    const suppressedText = suppressed?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const amazonResponsibility = suppressedVisible && /responsibilit/i.test(suppressedText);

    if (stars === 0 && !text) continue;

    items.push({ stars, text, ...parseRater(main.querySelector(sel.feedbackRater)?.textContent), amazonResponsibility });
  }

  return items;
}

function parseSellerInfo(html: string, seller: ProductSeller, url: string): SellerInfo {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return {
    sellerId: seller.id,
    name: seller.name,
    fulfilledByAmazon: seller.fulfilledByAmazon,
    url,
    periods: parsePeriods(doc),
    feedback: parseFeedback(doc),
    fetchedAt: Date.now()
  };
}

function cacheKey(sellerId: string): string {
  return CACHE_PREFIX + sellerId;
}

async function getCached(sellerId: string): Promise<SellerInfo | undefined> {
  const stored = await chrome.storage.local.get(cacheKey(sellerId));
  const cached = stored[cacheKey(sellerId)] as SellerInfo | undefined;
  if (!cached || Date.now() - cached.fetchedAt > CACHE_TTL_MS) return undefined;
  return cached;
}

// Dedupes concurrent loads for the same seller (e.g. card + detail opening together).
const pendingRequests = new Map<string, Promise<SellerInfo>>();

/** Returns the seller scorecard, from cache when fresh, otherwise fetched and parsed from the seller profile page. */
export async function loadSellerInfo(seller: ProductSeller): Promise<SellerInfo> {
  const cached = await getCached(seller.id);
  if (cached) return cached;

  const existing = pendingRequests.get(seller.id);
  if (existing) return existing;

  const url = `${location.origin}${getConfig().amazon.seller.profileUrlBase}${encodeURIComponent(seller.id)}`;
  const request = (async () => {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
      throw new Error("Couldn't load seller ratings. Please try again.");
    }
    const info = parseSellerInfo(await response.text(), seller, url);
    if (info.periods.length === 0) {
      throw new Error("Couldn't read seller ratings from Amazon.");
    }
    await chrome.storage.local.set({ [cacheKey(seller.id)]: info });
    return info;
  })();

  pendingRequests.set(seller.id, request);
  try {
    return await request;
  } finally {
    pendingRequests.delete(seller.id);
  }
}

/** Picks the most representative period for a headline (prefers 12-month, falls back to the largest sample). */
export function headlinePeriod(info: SellerInfo): SellerRatingPeriod | undefined {
  return (
    info.periods.find((period) => period.period === "365d") ??
    info.periods.find((period) => period.period === "lifetime") ??
    info.periods[info.periods.length - 1]
  );
}

/** Share of 4–5★ ratings, from a period's histogram. */
export function positivePercent(period: SellerRatingPeriod): number {
  return period.histogram
    .filter((bar) => bar.stars >= 4)
    .reduce((sum, bar) => sum + bar.percent, 0);
}

/** Human label for a rating window. */
export function periodLabel(period: SellerRatingPeriod["period"]): string {
  switch (period) {
    case "30d":
      return "1 month";
    case "90d":
      return "3 months";
    case "365d":
      return "12 months";
    case "lifetime":
      return "Lifetime";
  }
}
