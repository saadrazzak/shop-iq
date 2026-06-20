import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductSeller, SellerInfo } from "../../shared/types";
import { loadSellerInfo } from "../lib/sellerRating";

export type SellerRatingState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: SellerInfo }
  | { status: "error"; error: string };

/**
 * Lazily loads a seller's scorecard. Nothing is fetched until `load()` is
 * called (e.g. when the seller card first becomes visible), and repeat calls are
 * ignored while loading or once loaded — `load(true)` retries after an error.
 */
export function useSellerRating(seller?: ProductSeller) {
  const [state, setState] = useState<SellerRatingState>({ status: "idle" });
  const isMountedRef = useRef(true);
  const startedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset when the seller changes (navigating to another product).
  useEffect(() => {
    startedRef.current = false;
    setState({ status: "idle" });
  }, [seller?.id]);

  const load = useCallback(
    async (force = false) => {
      if (!seller) return;
      if (startedRef.current && !force) return;
      startedRef.current = true;

      setState({ status: "loading" });
      try {
        const data = await loadSellerInfo(seller);
        if (isMountedRef.current) setState({ status: "ready", data });
      } catch (error) {
        if (isMountedRef.current) {
          startedRef.current = false; // allow retry
          setState({
            status: "error",
            error: error instanceof Error ? error.message : "Couldn't load seller ratings."
          });
        }
      }
    },
    [seller]
  );

  return { state, load };
}
