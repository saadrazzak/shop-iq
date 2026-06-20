import { useEffect, useState } from "react";
import type { ComparisonResult, ProductData } from "../../shared/types";
import { sendRuntimeMessage } from "../../shared/messaging";

const EMPTY_COMPARISONS: ComparisonResult = { prices: [], reddit: [], youtube: [] };

/**
 * Loads the Social tab's data — retailer prices plus Reddit/YouTube discussions
 * — for `product` via the backend, fetching once per detected product (keyed on
 * ASIN). Returns the `comparisons`, a `loading` flag, and a manual
 * `fetchComparisons` trigger.
 */
export function useComparisons(product?: ProductData, enabled = true) {
  const [comparisons, setComparisons] = useState<ComparisonResult>(EMPTY_COMPARISONS);
  const [loading, setLoading] = useState(false);

  async function fetchComparisons() {
    if (!product) return;

    setLoading(true);
    try {
      const response = await sendRuntimeMessage<{ result: ComparisonResult }>({
        type: "SHOPIQ_GET_COMPARISONS",
        product
      });
      setComparisons(response.result);
    } catch (error) {
      console.error("Failed to fetch comparisons:", error);
      setComparisons({ ...EMPTY_COMPARISONS, error: "Failed to load comparisons" });
    } finally {
      setLoading(false);
    }
  }

  // Auto-fetch comparisons once per detected product, but only once `enabled`
  // (we hold off until the on-page AI price-history request has settled so the
  // heavy Reddit/YouTube/price scraping doesn't slow it down).
  useEffect(() => {
    if (product && enabled && !loading && comparisons.prices.length === 0) {
      void fetchComparisons();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.asin, enabled]);

  return { comparisons, loading, fetchComparisons };
}
