import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders its children and a variant-specific test id", () => {
    render(<Button variant="outline">Scan review pages</Button>);
    expect(screen.getByTestId("shopiq-button-outline")).toHaveTextContent("Scan review pages");
  });

  it("fires onClick when enabled and not when disabled", () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);

    fireEvent.click(screen.getByTestId("shopiq-button-primary"));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>
    );
    fireEvent.click(screen.getByTestId("shopiq-button-primary"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
