import { describe, expect, it } from "vitest";
import type { ReviewScanOptions } from "./types";
import { buildReviewUrl } from "./reviewUrl";

function options(overrides: Partial<ReviewScanOptions> = {}): ReviewScanOptions {
  return { sort: "top", verifiedOnly: false, star: "all", mediaOnly: false, ...overrides };
}

describe("buildReviewUrl", () => {
  it("builds a default first-page URL with the base params", () => {
    const url = new URL(buildReviewUrl("B0CXYZ1234", options()));
    expect(url.pathname).toBe("/product-reviews/B0CXYZ1234/");
    expect(url.searchParams.get("pageNumber")).toBe("1");
    expect(url.searchParams.get("reviewerType")).toBe("all_reviews");
    // Non-default params are omitted to mirror Amazon's own URLs.
    expect(url.searchParams.has("sortBy")).toBe(false);
    expect(url.searchParams.has("filterByStar")).toBe(false);
    expect(url.searchParams.has("mediaType")).toBe(false);
  });

  it("encodes verified-only as a different reviewerType", () => {
    const url = new URL(buildReviewUrl("B0CXYZ1234", options({ verifiedOnly: true })));
    expect(url.searchParams.get("reviewerType")).toBe("avp_only_reviews");
  });

  it("maps sort, star and media filters to Amazon's query params", () => {
    const url = new URL(
      buildReviewUrl("B0CXYZ1234", options({ sort: "recent", star: "five", mediaOnly: true }))
    );
    expect(url.searchParams.get("sortBy")).toBe("recent");
    expect(url.searchParams.get("filterByStar")).toBe("five_star");
    expect(url.searchParams.get("mediaType")).toBe("media_reviews_only");
  });

  it("sets the requested page number", () => {
    const url = new URL(buildReviewUrl("B0CXYZ1234", options(), 3));
    expect(url.searchParams.get("pageNumber")).toBe("3");
  });
});
