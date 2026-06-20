import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getChromeMock } from "../test/chrome-mock";
import { OverlayRoot } from "./OverlayRoot";

describe("OverlayRoot", () => {
  it("shows the launcher (not the overlay) when ui.open is false", async () => {
    render(<OverlayRoot />);

    await waitFor(() => expect(screen.getByTestId("shopiq-launcher-root")).toBeInTheDocument());
    expect(screen.queryByTestId("shopiq-overlay-root")).not.toBeInTheDocument();
  });

  it("shows the overlay when the background reports ui.open is true", async () => {
    const chrome = getChromeMock();
    chrome.runtime.sendMessage.mockImplementation((message: { type?: string }) => {
      if (message.type === "SHOPIQ_GET_STATE") {
        return Promise.resolve({
          state: { status: "idle" },
          ui: { open: true, activeTab: "summary" },
          scanResult: undefined
        });
      }
      return Promise.resolve({});
    });

    render(<OverlayRoot />);

    await waitFor(() => expect(screen.getByTestId("shopiq-overlay-root")).toBeInTheDocument());
    expect(screen.queryByTestId("shopiq-launcher-root")).not.toBeInTheDocument();
  });
});
