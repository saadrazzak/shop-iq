import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProductData, ScanResult } from "../../../shared/types";
import { ReviewsTab } from "./ReviewsTab";

/**
 * Regression guard for the scan/Summary decoupling bug: a completed scan's
 * reviews live in `scanResult` and must surface ONLY in the Reviews tab's
 * "Filtered reviews" list — never merged into the product's own review set.
 */

function product(): ProductData {
  return {
    source: "amazon.in",
    title: "Test Product",
    url: "https://www.amazon.in/dp/B0CXYZ1234",
    extractedAt: "2026-06-15T00:00:00.000Z",
    reviews: [
      { body: "PRODUCT_REVIEW_ALPHA", rating: 5 },
      { body: "PRODUCT_REVIEW_BETA", rating: 4 }
    ]
  };
}

const noop = () => {};

function scan(reviews: ScanResult["reviews"]): ScanResult {
  return { reviews, options: { sort: "top", verifiedOnly: false, star: "five", mediaOnly: false } };
}

describe("ReviewsTab", () => {
  it("shows the scan's filtered reviews and hides the product's own when a scanResult exists", () => {
    render(
      <ReviewsTab
        product={product()}
        isBusy={false}
        scanResult={scan([{ body: "SCAN_REVIEW_ONE", rating: 5 }])}
        onAnalyze={noop}
        onAnalyzeMore={noop}
      />
    );

    expect(screen.getByText("Filtered reviews")).toBeInTheDocument();
    expect(screen.getByText("SCAN_REVIEW_ONE")).toBeInTheDocument();
    // The product's own reviews must NOT leak into the scan result view.
    expect(screen.queryByText("PRODUCT_REVIEW_ALPHA")).not.toBeInTheDocument();
  });

  it("shows the empty-filter card when the scan returned no matching reviews", () => {
    render(
      <ReviewsTab
        product={product()}
        isBusy={false}
        scanResult={scan([])}
        onAnalyze={noop}
        onAnalyzeMore={noop}
      />
    );

    expect(screen.getByTestId("shopiq-reviews-empty")).toBeInTheDocument();
    expect(screen.queryByText("Filtered reviews")).not.toBeInTheDocument();
  });

  it("falls back to the product's own reviews when there is no scanResult", () => {
    render(<ReviewsTab product={product()} isBusy={false} onAnalyze={noop} onAnalyzeMore={noop} />);

    expect(screen.getByText("PRODUCT_REVIEW_ALPHA")).toBeInTheDocument();
    expect(screen.queryByText("Filtered reviews")).not.toBeInTheDocument();
  });
});
