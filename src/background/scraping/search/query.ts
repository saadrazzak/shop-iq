const MAX_QUERY_WORDS = 6;

/**
 * Reduces a verbose Amazon listing title (full of specs, capacities, and
 * colour variants) down to a short product name that search engines and
 * retailer APIs can actually match, e.g. "Apple 2023 MacBook Pro (16-inch, ...
 * 512GB) - Space Black" -> "Apple 2023 MacBook Pro", and
 * "OnePlus Nord 6 | 8GB+256GB | Pitch Black | ..." -> "OnePlus Nord 6". Cuts at
 * the first of `(`, `|`, or a spaced dash, then keeps the first few words.
 */
export function buildSearchQuery(productTitle: string): string {
  const corePart = productTitle.split(/\(|\||,|\s[-–—]\s/)[0];
  const words = corePart
    .trim()
    .replace(/[,:]+$/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_QUERY_WORDS);

  return words.join(" ");
}

const SEARCH_STOPWORDS = new Set([
  "with",
  "and",
  "the",
  "for",
  "of",
  "in",
  "on",
  "a",
  "an",
  "to",
  "by",
  "review",
  "reviews",
  "unboxing"
]);

/** A bare calendar year (e.g. "2025"), too generic on its own to identify a product. */
const YEAR_PATTERN = /^(19|20)\d{2}$/;

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !SEARCH_STOPWORDS.has(token) && !YEAR_PATTERN.test(token));
}

/** A token that likely identifies a specific model, e.g. "s24", "1000xm5", "buds4". */
function isModelToken(token: string): boolean {
  return /\d/.test(token);
}

/**
 * Generic marketing/spec vocabulary that shows up across unrelated products
 * (e.g. "wireless earbuds" or "smart watch" listings all share these words).
 * Excluded when picking "anchor" tokens so a match on "ultra" or "wireless"
 * alone can't make an unrelated result look relevant.
 */
const GENERIC_PRODUCT_WORDS = new Set([
  "smart",
  "wireless",
  "truly",
  "bluetooth",
  "earbuds",
  "earphones",
  "headphones",
  "watch",
  "watches",
  "calling",
  "charge",
  "charging",
  "battery",
  "playback",
  "water",
  "resistance",
  "resistant",
  "gaming",
  "mode",
  "latency",
  "display",
  "screen",
  "pro",
  "plus",
  "max",
  "ultra",
  "lite",
  "mini",
  "edition",
  "version",
  "storage",
  "memory",
  "chip",
  "processor",
  "camera",
  "premium",
  "original",
  "new",
  "official",
  "fast",
  "quick",
  "sound",
  "audio",
  "pulse",
  "heart",
  "rate",
  "fit",
  "tracker",
  "band",
  "series"
]);

/**
 * Checks whether a search result's text shares enough vocabulary with the
 * query to be considered relevant. Reddit's search engine falls back to
 * loosely-related posts for less popular products, so a result must mention
 * either a model-identifying token (e.g. "s24", "1000xm5") or a
 * brand/product-specific word (e.g. "macbook", "colorfit") - matching only on
 * generic marketing words like "ultra" or "wireless" isn't enough - plus
 * share at least one other word with the query.
 */
export function isRelevantResult(queryTokens: string[], text: string): boolean {
  if (queryTokens.length === 0) return true;

  const resultTokens = new Set(tokenize(text));
  const modelTokens = queryTokens.filter(isModelToken);
  if (modelTokens.some((token) => resultTokens.has(token))) return true;

  const anchors = queryTokens.filter((token) => !GENERIC_PRODUCT_WORDS.has(token));
  const anchorPool = anchors.length > 0 ? anchors : queryTokens;
  if (!anchorPool.some((token) => resultTokens.has(token))) return false;

  const overlap = queryTokens.filter((token) => resultTokens.has(token)).length;
  return overlap >= Math.min(2, queryTokens.length);
}

/**
 * Fraction (0–1) of the query's identifying tokens that appear in `text` — i.e.
 * "how much of the product name does this title cover?". Brand/model words drive
 * the score; generic marketing words ("wireless", "pro", "ultra") are dropped
 * from the denominator so they can't pad it.
 *
 * Two hard gates return 0 outright — the strongest "different product" signals:
 *  - `brandTokens` is known and none of them appear in the text (wrong brand),
 *  - the query has a model token (e.g. "1000xm5", "s24") absent from the text.
 *
 * Used to filter Reddit's loosely-related search results (YouTube titles are
 * already tight).
 */
export function relevanceScore(queryTokens: string[], text: string, brandTokens: string[] = []): number {
  if (queryTokens.length === 0) return 1;

  const resultTokens = new Set(tokenize(text));

  if (brandTokens.length > 0 && !brandTokens.some((token) => resultTokens.has(token))) return 0;

  const modelTokens = queryTokens.filter(isModelToken);
  if (modelTokens.length > 0 && !modelTokens.some((token) => resultTokens.has(token))) return 0;

  const anchors = queryTokens.filter((token) => !GENERIC_PRODUCT_WORDS.has(token));
  const pool = anchors.length > 0 ? anchors : queryTokens;
  const matched = pool.filter((token) => resultTokens.has(token)).length;
  return matched / pool.length;
}
