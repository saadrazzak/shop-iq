import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProductData } from "../../../shared/types";
import { SummaryTab } from "./SummaryTab";

/**
 * SummaryTab renders entirely from `product` + `analysis` (it has no
 * `scanResult` prop), so a deeper review scan can never alter what the
 * Summary shows. These tests assert it surfaces real product-page signals.
 */

function product(): ProductData {
  return {
    source: "amazon.in",
    title: "Wireless Headphones",
    url: "https://www.amazon.in/dp/B0CXYZ1234",
    price: "₹2,499",
    mrp: "₹3,000",
    discountPercent: "-17%",
    rating: "4.5 out of 5 stars",
    reviewCount: "1,204 ratings",
    imageUrl: "https://img/headphones.jpg",
    insightAspects: [{ label: "Sound quality", tone: "positive", mentions: 30 }],
    ratingDistribution: [
      { stars: 5, percent: 70 },
      { stars: 4, percent: 20 }
    ],
    reviews: [{ title: "Fantastic sound", body: "Crisp", rating: 5, domId: "R1" }],
    extractedAt: "2026-06-15T00:00:00.000Z"
  };
}

describe("SummaryTab", () => {
  it("renders the verdict and rating-breakdown cards from product data", () => {
    render(<SummaryTab product={product()} priceHistory={{ status: "idle" }} rufusEnabled={false} onEnableRufus={() => {}} />);

    expect(screen.getByTestId("shopiq-worth-buying-card")).toBeInTheDocument();
    expect(screen.getByTestId("shopiq-rating-breakdown-card")).toBeInTheDocument();
    // The real review title flows through to a highlight pill.
    expect(screen.getByText("Fantastic sound")).toBeInTheDocument();
  });
});
