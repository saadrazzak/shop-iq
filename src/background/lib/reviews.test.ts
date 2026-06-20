import { describe, expect, it } from "vitest";
import type { ProductData } from "../../shared/types";
import { mergeProductReviews } from "./reviews";

function product(reviews: ProductData["reviews"]): ProductData {
  return {
    source: "amazon.in",
    title: "Test",
    url: "https://www.amazon.in/dp/B0CXYZ1234",
    extractedAt: "2026-06-15T00:00:00.000Z",
    reviews
  };
}

describe("mergeProductReviews", () => {
  it("drops reviews with an empty body", () => {
    const result = mergeProductReviews(product([{ body: "" }, { body: "Good phone" }]));
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews[0].body).toBe("Good phone");
  });

  it("de-dupes by case-insensitive title:body, keeping the first occurrence", () => {
    const result = mergeProductReviews(
      product([
        { title: "Nice", body: "Loved it" },
        { title: "nice", body: "loved it" }, // same key, different case
        { title: "Nice", body: "Different body" }
      ])
    );
    expect(result.reviews).toHaveLength(2);
    expect(result.reviews.map((r) => r.body)).toEqual(["Loved it", "Different body"]);
  });

  it("preserves the other product fields", () => {
    const input = product([{ body: "x" }]);
    const result = mergeProductReviews(input);
    expect(result).toMatchObject({ title: "Test", url: input.url });
  });
});
