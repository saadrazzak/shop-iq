import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewScanner } from "./ReviewScanner";

describe("ReviewScanner", () => {
  it("scans with the chosen sort/star/verified options", () => {
    const onScan = vi.fn();
    render(<ReviewScanner isBusy={false} onScan={onScan} />);

    fireEvent.click(screen.getByTestId("shopiq-review-scanner-sort-recent"));
    fireEvent.click(screen.getByTestId("shopiq-review-scanner-star-five"));
    fireEvent.click(screen.getByTestId("shopiq-review-scanner-verified"));
    fireEvent.click(screen.getByTestId("shopiq-button-outline"));

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith({
      sort: "recent",
      star: "five",
      verifiedOnly: true,
      mediaOnly: false
    });
  });

  it("restores previously saved options and shows scan progress while busy", () => {
    render(
      <ReviewScanner
        isBusy
        scanProgress={{ page: 1, pageLimit: 2 }}
        savedOptions={{ sort: "recent", verifiedOnly: true, star: "four", mediaOnly: false }}
        onScan={vi.fn()}
      />
    );

    expect(screen.getByTestId("shopiq-review-scanner-star-four")).toHaveClass("bg-shopiq-brand");
    expect(screen.getByText(/page 1 of 2/)).toBeInTheDocument();
    expect(screen.getByTestId("shopiq-button-outline")).toBeDisabled();
  });
});
