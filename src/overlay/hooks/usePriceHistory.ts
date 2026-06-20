import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductData } from "../../shared/types";
import { getPriceHistoryCacheKey, loadPriceHistory, type PriceHistoryData } from "../lib/priceHistory";

export type PriceHistoryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: PriceHistoryData }
  | { status: "error"; error: string }
  /** The user hasn't consented to querying Amazon's AI assistant (Rufus). */
  | { status: "disabled" };

const IDLE_STATE: PriceHistoryState = { status: "idle" };

/**
 * Loads price history for `product` in the background as soon as it's available
 * (cache-first); `refresh(true)` bypasses the cache. `autoFetchDelayMs` delays
 * only the initial automatic fetch (not manual `refresh` calls), giving the page
 * time to settle before querying Amazon's AI assistant.
 *
 * `enabled` gates all Rufus access: when false, nothing is fetched and the state
 * is `"disabled"`. Flipping it to true triggers the auto-fetch.
 */
export function usePriceHistory(product?: ProductData, autoFetchDelayMs = 0, enabled = true) {
  const [state, setState] = useState<PriceHistoryState>(IDLE_STATE);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(
    async (forceRefresh = false) => {
      if (!product) return;
      setState({ status: "loading" });
      try {
        const data = await loadPriceHistory(product, forceRefresh);
        if (isMountedRef.current) setState({ status: "ready", data });
      } catch (error) {
        if (isMountedRef.current) {
          setState({
            status: "error",
            error: error instanceof Error ? error.message : "Something went wrong."
          });
        }
      }
    },
    [product]
  );

  const cacheKey = product ? getPriceHistoryCacheKey(product) : undefined;

  useEffect(() => {
    if (!cacheKey) return;

    // Opt-in gate: never touch Rufus until the user consents.
    if (!enabled) {
      setState({ status: "disabled" });
      return;
    }

    if (autoFetchDelayMs <= 0) {
      void refresh();
      return;
    }

    const timeoutId = window.setTimeout(() => void refresh(), autoFetchDelayMs);
    return () => window.clearTimeout(timeoutId);
    // Re-run when the product changes or consent is granted/revoked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled]);

  return { state, refresh };
}
