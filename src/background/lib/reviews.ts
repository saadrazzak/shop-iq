import type { ProductData } from "../../shared/types";

/**
 * De-duplicates a product's reviews by a case-insensitive `title:body` key and
 * drops any with an empty body. Used both when merging freshly extracted
 * product-page reviews and when folding in reviews from a manual review-page
 * visit, so the analyzed set never contains the same review twice.
 */
export function mergeProductReviews(product: ProductData): ProductData {
  const seen = new Set<string>();
  const reviews = product.reviews.filter((review) => {
    const key = `${review.title ?? ""}:${review.body}`.toLowerCase();
    if (!review.body || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    ...product,
    reviews
  };
}
