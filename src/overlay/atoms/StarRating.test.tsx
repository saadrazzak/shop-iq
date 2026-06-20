import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StarRating } from "./StarRating";

describe("StarRating", () => {
  it("always renders five stars and an accessible label", () => {
    render(<StarRating rating={4.2} />);
    const row = screen.getByTestId("shopiq-star-rating");
    expect(row).toHaveAttribute("aria-label", "4.2 out of 5 stars");
    expect(row.querySelectorAll("svg")).toHaveLength(5);
  });

  it("fills up to the rounded rating", () => {
    render(<StarRating rating={3.6} color="#123456" />);
    const stars = screen.getByTestId("shopiq-star-rating").querySelectorAll("svg");
    // 3.6 rounds to 4 filled stars.
    const filled = Array.from(stars).filter((s) => s.getAttribute("fill") === "#123456");
    expect(filled).toHaveLength(4);
  });
});
