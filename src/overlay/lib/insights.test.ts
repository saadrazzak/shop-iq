import { describe, expect, it } from "vitest";
import type { AnalysisResult, ProductData } from "../../shared/types";
import {
  PALETTE,
  getAverageRating,
  getInsightTags,
  getRealRatingBreakdown,
  getReviewHighlights,
  getWorthBuyingVerdict,
  ratingToColor,
  toneToColor
} from "./insights";

/** Minimal product fixture; tests spread overrides onto it. */
function product(overrides: Partial<ProductData> = {}): ProductData {
  return {
    source: "amazon.in",
    title: "Test Product",
    url: "https://www.amazon.in/dp/B0TEST00000",
    reviews: [],
    extractedAt: "2026-06-15T00:00:00.000Z",
    ...overrides
  };
}

describe("ratingToColor", () => {
  it("maps each whole star to its scale color and rounds", () => {
    expect(ratingToColor(1)).toBe("#dc2626");
    expect(ratingToColor(5)).toBe("#15803d");
    expect(ratingToColor(4.6)).toBe("#15803d"); // rounds to 5
  });

  it("clamps out-of-range values into 1..5", () => {
    expect(ratingToColor(0)).toBe("#dc2626");
    expect(ratingToColor(99)).toBe("#15803d");
  });
});

describe("toneToColor", () => {
  it("maps tones to green / red / neutral", () => {
    expect(toneToColor("positive")).toBe("#15803d");
    expect(toneToColor("negative")).toBe("#dc2626");
    expect(toneToColor("mixed")).toBe(PALETTE.slate);
  });
});

describe("getAverageRating", () => {
  it("prefers the authoritative product-page rating over the scanned sample average", () => {
    const analysis = { averageReviewRating: 4.2 } as AnalysisResult;
    expect(getAverageRating(product({ rating: "3.0 out of 5 stars" }), analysis)).toBe(3);
  });

  it("falls back to the scanned average when the product page has no rating", () => {
    const analysis = { averageReviewRating: 4.2 } as AnalysisResult;
    expect(getAverageRating(product(), analysis)).toBe(4.2);
  });

  it("parses the product rating string when there is no analysis", () => {
    expect(getAverageRating(product({ rating: "4.7 out of 5 stars" }))).toBe(4.7);
    expect(getAverageRating(product({ rating: "4.7" }))).toBe(4.7);
  });

  it("returns undefined when nothing is available", () => {
    expect(getAverageRating(product())).toBeUndefined();
    expect(getAverageRating()).toBeUndefined();
  });
});

describe("getRealRatingBreakdown", () => {
  it("uses the real histogram when present, ordered 5★ → 1★", () => {
    const segments = getRealRatingBreakdown(
      product({
        ratingDistribution: [
          { stars: 5, percent: 70 },
          { stars: 4, percent: 20 },
          { stars: 1, percent: 10 }
        ]
      })
    );
    expect(segments.map((s) => s.label)).toEqual(["5 star", "4 star", "3 star", "2 star", "1 star"]);
    expect(segments[0].percent).toBe(70);
    expect(segments[2].percent).toBe(0); // 3★ absent from histogram → 0
  });

  it("falls back to a stub distribution when there is no data", () => {
    const segments = getRealRatingBreakdown(product());
    expect(segments).toHaveLength(5);
    expect(segments[0]).toMatchObject({ label: "5 star", percent: 68 });
  });
});

describe("getReviewHighlights", () => {
  it("builds highlights from titled, rated reviews and shortens long titles", () => {
    const highlights = getReviewHighlights(
      product({
        reviews: [
          { title: "Amazing battery and great value for money here", body: "x", rating: 5, domId: "R1" },
          { title: "Poor", body: "y", rating: 2 }
        ]
      })
    );
    expect(highlights[0].label).toBe("Amazing battery and great value…"); // first 5 words + ellipsis
    expect(highlights[0].rating).toBe(5);
    expect(highlights[0].pageElementId).toBe("R1");
    expect(highlights[1]).toMatchObject({ label: "Poor", rating: 2 });
  });

  it("falls back to stub highlights when no titled/rated reviews exist", () => {
    const highlights = getReviewHighlights(product({ reviews: [{ body: "no title", rating: 4 }] }));
    expect(highlights.map((h) => h.label)).toContain("Great battery life");
  });
});

describe("getInsightTags", () => {
  it("maps real 'Customers say' aspects when present", () => {
    const tags = getInsightTags(
      product({
        insightAspects: [
          { label: "Battery life", tone: "positive", mentions: 24, domAriaControls: "aspect-1" }
        ]
      })
    );
    expect(tags).toEqual([
      { label: "Battery life", tone: "positive", mentions: 24, domAriaControls: "aspect-1" }
    ]);
  });

  it("falls back to backend themes, then to empty", () => {
    const analysis = { themes: { positive: ["sound"], negative: ["price"] } } as AnalysisResult;
    const tags = getInsightTags(product(), analysis);
    expect(tags).toEqual([
      { label: "Sound", tone: "positive" },
      { label: "Price", tone: "negative" }
    ]);
    expect(getInsightTags(product())).toEqual([]);
  });
});

describe("getWorthBuyingVerdict", () => {
  it("scores from the share of positive aspect pills", () => {
    const verdict = getWorthBuyingVerdict(
      product({
        insightAspects: [
          { label: "Quality", tone: "positive", mentions: 10 },
          { label: "Value", tone: "positive", mentions: 8 }
        ]
      })
    );
    expect(verdict.score).toBe(100);
    expect(verdict.label).toBe("Excellent buy");
    expect(verdict.positive).toBe(true);
    expect(verdict.tagline).toContain("praise");
  });

  it("writes a love/flag tagline for a mixed aspect set", () => {
    const verdict = getWorthBuyingVerdict(
      product({
        insightAspects: [
          { label: "Camera", tone: "positive", mentions: 10 },
          { label: "Heating", tone: "negative", mentions: 6 }
        ]
      })
    );
    expect(verdict.score).toBe(50);
    expect(verdict.label).toBe("Mixed bag");
    expect(verdict.positive).toBe(false);
    expect(verdict.tagline).toMatch(/love .*but flag/);
  });

  it("uses a neutral analyzing stub when neither aspects nor analysis exist", () => {
    const verdict = getWorthBuyingVerdict(product());
    expect(verdict.score).toBe(75);
    expect(verdict.label).toBe("Worth buying");
    expect(verdict.tagline).toContain("Analyzing");
  });
});
