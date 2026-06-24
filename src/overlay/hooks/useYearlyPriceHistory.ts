import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductData } from "../../shared/types";
import { getYearlyPriceHistoryCacheKey, loadYearlyPriceHistory, type PriceHistoryData } from "../lib/priceHistory";

export type YearlyPriceHistoryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: PriceHistoryData }
  | { status: "error"; error: string };

const IDLE_STATE: YearlyPriceHistoryState = { status: "idle" };

/**
 * Loads the separate, weekly-resolution 1-year price history for `product` -
 * but only when `load()` is actually called (e.g. the user opens the 1-year
 * tab). Unlike `usePriceHistory`, there's no auto-fetch: this is the heavier,
 * on-demand fetch the user explicitly opts into per product.
 */
export function useYearlyPriceHistory(product?: ProductData) {
  const [state, setState] = useState<YearlyPriceHistoryState>(IDLE_STATE);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (forceRefresh = false) => {
      if (!product) return;
      setState({ status: "loading" });
      try {
        const data = await loadYearlyPriceHistory(product, forceRefresh);
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

  const cacheKey = product ? getYearlyPriceHistoryCacheKey(product) : undefined;

  // Reset to idle when the product changes, so switching products doesn't
  // show a stale "ready"/"error" state until the user re-triggers a load.
  useEffect(() => {
    setState(IDLE_STATE);
  }, [cacheKey]);

  return { state, load };
}
