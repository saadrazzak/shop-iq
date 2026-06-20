import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductData } from "../../shared/types";
import { getProsConsCacheKey, loadProsCons, type ProsConsResult } from "../lib/priceHistory";

export type ProsConsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: ProsConsResult }
  | { status: "error"; error: string };

/**
 * Lazily fetches AI pros/cons from Rufus on a separate prompt. Nothing runs
 * until `load()` is called (e.g. when the user expands the Pros & Cons section),
 * so most users never pay for the second assistant round-trip. Repeat calls are
 * ignored while loading or once loaded; `load(true)` forces a refresh.
 */
export function useAssistantProsCons(product?: ProductData) {
  const [state, setState] = useState<ProsConsState>({ status: "idle" });
  const isMountedRef = useRef(true);
  const startedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset when the product changes (navigating to another product).
  const cacheKey = product ? getProsConsCacheKey(product) : undefined;
  useEffect(() => {
    startedRef.current = false;
    setState({ status: "idle" });
  }, [cacheKey]);

  const load = useCallback(
    async (force = false) => {
      if (!product) return;
      if (startedRef.current && !force) return;
      startedRef.current = true;

      setState({ status: "loading" });
      try {
        const data = await loadProsCons(product, force);
        if (isMountedRef.current) setState({ status: "ready", data });
      } catch (error) {
        if (isMountedRef.current) {
          startedRef.current = false; // allow retry
          setState({
            status: "error",
            error: error instanceof Error ? error.message : "Couldn't load pros & cons."
          });
        }
      }
    },
    [product]
  );

  return { state, load };
}
