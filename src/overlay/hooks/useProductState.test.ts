import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getChromeMock } from "../../test/chrome-mock";
import { useProductState } from "./useProductState";

describe("useProductState", () => {
  it("loads state and ui from the background on mount", async () => {
    const chrome = getChromeMock();
    chrome.runtime.sendMessage.mockResolvedValueOnce({
      state: { status: "complete" },
      ui: { open: true, activeTab: "reviews" }
    });

    const { result } = renderHook(() => useProductState());

    await waitFor(() => expect(result.current.state.status).toBe("complete"));
    expect(result.current.ui).toEqual({ open: true, activeTab: "reviews" });
    // Scan results are fetched in-place by the overlay now, not synced from the background.
    expect(result.current.scanResult).toBeUndefined();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: "SHOPIQ_GET_STATE" });
  });

  it("optimistically patches ui and persists the patch via SHOPIQ_SET_UI", async () => {
    const chrome = getChromeMock();
    const { result } = renderHook(() => useProductState());
    await waitFor(() => expect(chrome.runtime.sendMessage).toHaveBeenCalled());

    act(() => result.current.setUi({ open: true }));

    expect(result.current.ui.open).toBe(true);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: "SHOPIQ_SET_UI", ui: { open: true } });
  });

  it("recovers to an error state (no stuck spinner) when an analysis request rejects", async () => {
    const chrome = getChromeMock();
    const { result } = renderHook(() => useProductState());
    await waitFor(() => expect(chrome.runtime.sendMessage).toHaveBeenCalled());

    // The SHOPIQ_ANALYZE_PRODUCT round-trip fails at the messaging layer.
    chrome.runtime.sendMessage.mockRejectedValueOnce(new Error("channel closed"));
    await act(async () => {
      await result.current.analyzeSnapshot();
    });

    expect(result.current.state.status).toBe("error");
    expect(result.current.state.error).toMatch(/Couldn't reach ShopIQ/);
  });

  it("applies state the background pushes via SHOPIQ_STATE", async () => {
    const chrome = getChromeMock();
    const { result } = renderHook(() => useProductState());
    await waitFor(() => expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled());

    const handler = chrome.runtime.onMessage.addListener.mock.calls[0][0] as (m: unknown) => void;
    act(() => handler({ type: "SHOPIQ_STATE", state: { status: "analyzing" } }));

    expect(result.current.state.status).toBe("analyzing");
  });
});
