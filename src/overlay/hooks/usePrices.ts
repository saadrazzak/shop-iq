import { useEffect, useState } from "react";
import type { PriceComparison, ProductData } from "../../shared/types";
import { sendRuntimeMessage } from "../../shared/messaging";

export type PricesState = {
  comparison?: PriceComparison;
  loading: boolean;
  error?: string;
};

const IDLE_STATE: PricesState = { loading: false };

/**
 * Loads live prices from other retailers for `product` (once per product);
 * `refresh(true)` re-scrapes. The auto-fetch waits until `enabled` is true so
 * heavy retailer scraping doesn't compete with the on-page AI price-history
 * request for the main thread while the overlay is open.
 */
export function usePrices(product?: ProductData, enabled = true) {
  const [state, setState] = useState<PricesState>(IDLE_STATE);

  async function fetchPrices(forceRefresh = false) {
    if (!product) return;
    setState((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const response = await sendRuntimeMessage<{ result: PriceComparison }>({
        type: "SHOPIQ_GET_PRICES",
        product,
        forceRefresh
      });
      const comparison = response.result;
      setState((prev) => ({ ...prev, comparison, loading: false, error: comparison.error }));
    } catch (error) {
      console.error("Failed to fetch prices:", error);
      setState((prev) => ({ ...prev, loading: false, error: "Failed to load prices" }));
    }
  }

  useEffect(() => {
    if (product && enabled) void fetchPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.asin, enabled]);

  return { ...state, refresh: fetchPrices };
}
