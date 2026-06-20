/**
 * Fetches and parses Amazon product-review pages in place — no tab navigation.
 * The product-reviews page is same-origin with the PDP, so we `fetch()` each
 * page (with the user's cookies) and parse the HTML with `DOMParser`, reusing
 * the same review extractor used for on-page scraping.
 */
import type { ProductReview, ReviewScanOptions } from "../../shared/types";
import { buildReviewUrl } from "../../shared/reviewUrl";
import { extractReviewsFrom } from "../../content/amazon";

/** A review is worth keeping for the list if it has text or attached media. */
function isMeaningful(review: ProductReview): boolean {
  return review.body.length > 0 || Boolean(review.hasMedia);
}

/** Dedupe key — the review's element id, falling back to its body text. */
function reviewKey(review: ProductReview): string {
  return (review.domId ?? review.body).toLowerCase();
}

/**
 * Crawls up to `maxPages` review pages for `asin` with the given filters and
 * returns the deduped reviews. Stops early once a page yields no new reviews
 * (the end of the list, or Amazon limiting signed-out results).
 */
export async function fetchReviewPages(
  asin: string,
  options: ReviewScanOptions,
  maxPages: number,
  onProgress?: (page: number) => void
): Promise<ProductReview[]> {
  const seen = new Set<string>();
  const collected: ProductReview[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    onProgress?.(page);

    let html: string;
    try {
      const response = await fetch(buildReviewUrl(asin, options, page), { credentials: "include" });
      if (!response.ok) break;
      html = await response.text();
    } catch {
      break;
    }

    const doc = new DOMParser().parseFromString(html, "text/html");
    const reviews = extractReviewsFrom(doc).filter(isMeaningful);
    if (reviews.length === 0) break;

    let added = 0;
    for (const review of reviews) {
      const key = reviewKey(review);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      collected.push(review);
      added += 1;
    }
    if (added === 0) break; // page repeated earlier reviews — no more new content
  }

  return collected;
}
