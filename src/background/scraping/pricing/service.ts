import type { PriceComparison, PriceConfidence, PriceResult, RetailerPrice } from "../../../shared/types";
import type { PriceComparisonInput } from "../types";
import { comparePrices } from "../scrapers";
import { parsePrice, variantDiffers } from "../matching/product-matcher";
import { priceStore, priceCacheKey } from "./store";

/**
 * `confidenceScore` (0-1) cut-offs for the human-readable bands. A correct
 * product match scores ~0.7-0.95; a same-brand *different model* (e.g. WH-CH720N
 * when you searched WH-1000XM5) lands ~0.35-0.45, which is why `low` is dropped
 * entirely below — surfacing a cheaper wrong product is worse than showing nothing.
 */
const CONFIDENCE_BANDS = { high: 0.6, medium: 0.5 } as const;

/** A genuine listing should be within this band of the Amazon price. Outside it
 * (e.g. a ₹299 phone "case" matching a ₹70,000 phone) is almost always a wrong
 * match or an accessory, so we drop it when the Amazon price is known. */
const PRICE_SANITY = { minRatio: 0.2, maxRatio: 5 } as const;

/** Maps a 0-1 match `confidenceScore` to its human-readable band. */
export function toConfidenceBand(score: number): PriceConfidence {
  if (score >= CONFIDENCE_BANDS.high) return "high";
  if (score >= CONFIDENCE_BANDS.medium) return "medium";
  return "low";
}

function toRetailerPrice(result: PriceResult, originalTitle: string): RetailerPrice {
  return {
    ...result,
    confidence: toConfidenceBand(result.confidenceScore),
    match: variantDiffers(originalTitle, result.title) ? "variant" : "exact"
  };
}

/**
 * MRP (Maximum Retail Price) is set by the manufacturer and must be identical
 * across all Indian retailers for the same SKU. When the Amazon crossed-out
 * price and the retailer's crossed-out price (`originalPrice`) match within 2%
 * it is a strong signal the listing is the same product — boost confidence.
 * When they differ by >15% it is likely a different SKU — penalise.
 */
function applyMrpAdjustment(result: PriceResult, amazonMrp: number | undefined): PriceResult {
  if (!amazonMrp || !result.originalPrice) return result;
  const diff = Math.abs(amazonMrp - result.originalPrice) / amazonMrp;
  let adjustment = 0;
  if (diff <= 0.02) adjustment = 0.25;
  else if (diff > 0.15) adjustment = -0.15;
  if (adjustment === 0) return result;
  return { ...result, confidenceScore: Math.min(1, Math.max(0, result.confidenceScore + adjustment)) };
}

type GetOptions = { forceRefresh?: boolean };

/**
 * Returns live prices for `input` from the retailers relevant to its category,
 * ranked best-match first. Cache-first (keyed by title + category);
 * `forceRefresh` always re-scrapes. Filters out low-confidence and
 * out-of-range-price listings so we never present a wrong/accessory product.
 */
export async function getPriceComparison(
  input: PriceComparisonInput,
  options: GetOptions = {}
): Promise<PriceComparison> {
  const categoryAlias = input.category?.alias;
  const key = priceCacheKey(input.title, categoryAlias);

  if (!options.forceRefresh) {
    const cached = await priceStore.get(key);
    if (cached) return { ...cached, cached: true };
  }

  const results = await comparePrices(input.title, categoryAlias);
  const amazonPrice = parsePrice(input.price);
  const amazonMrp = parsePrice(input.mrp);

  const prices = results
    .map((result) => applyMrpAdjustment(result, amazonMrp))
    .map((result) => toRetailerPrice(result, input.title))
    // Drop likely-wrong matches.
    .filter((price) => price.confidence !== "low")
    // Drop prices wildly off from the Amazon price (accessories, wrong matches).
    .filter((price) => {
      if (!amazonPrice) return true;
      return (
        price.price >= amazonPrice * PRICE_SANITY.minRatio &&
        price.price <= amazonPrice * PRICE_SANITY.maxRatio
      );
    });

  const comparison: PriceComparison = {
    query: input.title,
    prices,
    fetchedAt: new Date().toISOString(),
    cached: false
  };

  await priceStore.set(key, comparison);
  return comparison;
}
