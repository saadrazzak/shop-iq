import type {
  AnalysisResult,
  ComparisonResult,
  PriceComparison,
  ProductData,
  ProductState
} from "../shared/types";
import { mergeProductReviews } from "./lib/reviews";
import { setProductState } from "./state";
import { localAnalysis } from "./scraping/analysis/localAnalysis";
import { getPriceComparison } from "./scraping/pricing/service";
import { searchReddit } from "./scraping/search/reddit";
import { searchYoutube } from "./scraping/search/youtube";

// Scraping + analysis run entirely inside the extension's background worker
// (ported from the old shopiq-backend) — no server or external API required.

/** Runs the heuristic review analysis locally (pure — no network). */
export async function analyzeProduct(product: ProductData): Promise<AnalysisResult> {
  return localAnalysis(product);
}

/** De-dupes the product's reviews, analyzes them, and stores the resulting "complete" state for the tab. */
export async function analyzeAndStore(tabId: number, product: ProductData): Promise<ProductState> {
  const mergedProduct = mergeProductReviews(product);
  const analysis = await analyzeProduct(mergedProduct);
  const state: ProductState = {
    status: "complete",
    product: mergedProduct,
    analysis
  };
  return setProductState(tabId, state);
}

/** Returns the settled value, or `fallback` if it rejected (logging why). */
function settledOr<T>(outcome: PromiseSettledResult<T>, fallback: T, label: string): T {
  if (outcome.status === "fulfilled") return outcome.value;
  console.error(`comparisons: ${label} failed:`, outcome.reason);
  return fallback;
}

/**
 * Retailer prices + Reddit/YouTube discussions, scraped locally. Each source is
 * independent (allSettled), so one failing still returns the others.
 */
export async function fetchComparisons(product: ProductData): Promise<ComparisonResult> {
  const [pricesOutcome, redditOutcome, youtubeOutcome] = await Promise.allSettled([
    getPriceComparison({
      title: product.title,
      url: product.url,
      price: product.price,
      mrp: product.mrp,
      image: product.imageUrl,
      category: product.category
    }),
    searchReddit(product.title, product.brand),
    searchYoutube(product.title)
  ]);

  return {
    prices: settledOr<PriceComparison | null>(pricesOutcome, null, "prices")?.prices ?? [],
    reddit: settledOr(redditOutcome, [], "reddit"),
    youtube: settledOr(youtubeOutcome, [], "youtube")
  };
}

/** Live price comparison for a product, scraped locally and cached per-user. */
export async function fetchPrices(product: ProductData, forceRefresh?: boolean): Promise<PriceComparison> {
  return getPriceComparison(
    {
      title: product.title,
      url: product.url,
      price: product.price,
      mrp: product.mrp,
      image: product.imageUrl,
      category: product.category
    },
    { forceRefresh }
  );
}
