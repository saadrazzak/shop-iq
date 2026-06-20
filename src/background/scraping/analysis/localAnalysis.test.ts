import { describe, expect, it } from "vitest";
import type { ProductData } from "../../../shared/types";
import { localAnalysis } from "./localAnalysis";

function product(overrides: Partial<ProductData> = {}): ProductData {
  return {
    source: "amazon.in",
    title: "Test Product",
    url: "https://www.amazon.in/dp/B0CXYZ1234",
    reviews: [],
    extractedAt: "2026-06-15T00:00:00.000Z",
    ...overrides
  };
}

describe("localAnalysis", () => {
  it("produces a positive verdict from strong, highly-rated reviews", () => {
    const result = localAnalysis(
      product({
        reviews: [
          { body: "Great quality and excellent value, totally worth it", rating: 5 },
          { body: "Good build, nice features, very satisfied", rating: 5 },
          { body: "Best purchase, useful and great", rating: 4 }
        ]
      })
    );

    expect(result.buyScore).toBeGreaterThanOrEqual(75);
    expect(result.verdict).toMatch(/lean positive/);
    expect(result.reviewsAnalyzed).toBe(3);
    expect(result.averageReviewRating).toBeCloseTo(4.7, 1);
    expect(result.themes.positive.length).toBeGreaterThan(0);
    expect(result.bestReview?.rating).toBe(5);
    expect(result.worstReview?.rating).toBe(4);
  });

  it("produces a cautious verdict and negative themes from poor reviews", () => {
    const result = localAnalysis(
      product({
        reviews: [{ body: "Poor quality, defective unit, the worst, broken on arrival", rating: 1 }]
      })
    );

    expect(result.buyScore).toBeLessThan(55);
    expect(result.verdict).toMatch(/cautious or skip/);
    expect(result.themes.negative.length).toBeGreaterThan(0);
  });

  it("de-duplicates identical reviews before analyzing", () => {
    const result = localAnalysis(
      product({
        reviews: [
          { body: "Same exact text", rating: 4 },
          { body: "Same exact text", rating: 4 }
        ]
      })
    );
    expect(result.reviewsAnalyzed).toBe(1);
  });

  it("falls back to a neutral score and metadata-only pros when there are no reviews", () => {
    const result = localAnalysis(product());
    expect(result.buyScore).toBe(55);
    expect(result.reviewsAnalyzed).toBe(0);
    expect(result.confidence).toBe("low");
    expect(result.pros[0]).toMatch(/No review text/);
    expect(result.averageReviewRating).toBeUndefined();
  });

  it("uses the product rating when reviews carry no per-review rating", () => {
    const result = localAnalysis(product({ rating: "4.5 out of 5 stars", reviews: [{ body: "decent" }] }));
    // base = 4.5 * 16 = 72, plus a small confidence boost → comfortably positive.
    expect(result.buyScore).toBeGreaterThan(55);
  });
});
