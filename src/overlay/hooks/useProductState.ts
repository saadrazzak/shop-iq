import { useEffect, useState } from "react";
import type {
  ExtensionMessage,
  OverlayUi,
  ProductState,
  ReviewScanOptions,
  ReviewScanProgress,
  ScanResult
} from "../../shared/types";
import { sendRuntimeMessage } from "../../shared/messaging";
import { getConfig } from "../../config";
import { fetchReviewPages } from "../lib/reviewScan";

const EMPTY_STATE: ProductState = { status: "idle" };
const DEFAULT_UI: OverlayUi = { open: false, activeTab: "summary" };
const POLL_INTERVAL_MS = 1200;

type StateResponse = { state: ProductState; ui?: OverlayUi; scanResult?: ScanResult };

/**
 * The overlay's connection to the background's per-tab store. Returns the
 * product `state`, persisted overlay `ui` (open/active-tab), and the latest
 * `scanResult`, plus actions to mutate them.
 *
 * Side effects: fetches a snapshot on mount (`SHOPIQ_GET_STATE`); listens for
 * `SHOPIQ_STATE` pushes so freshly-analyzed data appears without polling; and
 * while a scan/analysis is in flight (`opening-reviews`/`analyzing`), polls
 * every {@link POLL_INTERVAL_MS}ms until it settles. `setUi` updates locally
 * and persists the patch so it survives the scan's page navigations.
 */
export function useProductState() {
  const [state, setState] = useState<ProductState>(EMPTY_STATE);
  const [ui, setUiState] = useState<OverlayUi>(DEFAULT_UI);
  // Scan results now come from an in-place fetch (no navigation), so they live
  // only in the overlay — not in the background's per-tab store.
  const [scanResult, setScanResult] = useState<ScanResult | undefined>(undefined);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ReviewScanProgress | undefined>(undefined);

  async function refreshState() {
    try {
      const response = await sendRuntimeMessage<StateResponse>({ type: "SHOPIQ_GET_STATE" });
      setState(response.state);
      if (response.ui) setUiState(response.ui);
    } catch (error) {
      // Background unreachable (service worker still spinning up, or the
      // extension was just reloaded). Keep whatever we have — a later poll or
      // a pushed SHOPIQ_STATE recovers it — rather than throwing here.
      console.warn("ShopIQ: failed to read state", error);
    }
  }

  /** Update overlay UI state locally and persist it per-tab so it survives scan navigations. */
  function setUi(patch: Partial<OverlayUi>) {
    setUiState((current) => ({ ...current, ...patch }));
    void sendRuntimeMessage({ type: "SHOPIQ_SET_UI", ui: patch });
  }

  async function analyzeSnapshot() {
    setState((current) => ({ ...current, status: "analyzing" }));
    try {
      const response = await sendRuntimeMessage<StateResponse>({ type: "SHOPIQ_ANALYZE_PRODUCT" });
      setState(response.state);
    } catch (error) {
      // Never leave the "analyzing" spinner stuck if the message itself fails.
      console.warn("ShopIQ: analysis request failed", error);
      setState((current) => ({
        ...current,
        status: "error",
        error: "Couldn't reach ShopIQ. Check your connection and try again."
      }));
    }
  }

  /**
   * Fetches more review pages in place (no tab navigation) and shows them in the
   * Reviews tab. These are display-only and never feed the buy-score, which
   * stays anchored to the product page's own reviews.
   */
  async function analyzeMoreReviews(options: ReviewScanOptions) {
    const asin = state.product?.asin;
    if (!asin) {
      setState((current) => ({
        ...current,
        status: "error",
        error: "ASIN was not found, so ShopIQ cannot load more reviews."
      }));
      return;
    }

    const pageLimit = getConfig().thresholds.reviewScanPageLimit;
    setScanning(true);
    setScanProgress({ page: 1, pageLimit });
    try {
      const reviews = await fetchReviewPages(asin, options, pageLimit, (page) =>
        setScanProgress({ page, pageLimit })
      );
      setScanResult({ reviews, options });
    } catch (error) {
      console.warn("ShopIQ: review fetch failed", error);
      setState((current) => ({
        ...current,
        status: "error",
        error: "Couldn't load more reviews. Please try again."
      }));
    } finally {
      setScanning(false);
      setScanProgress(undefined);
    }
  }

  useEffect(() => {
    void refreshState();
  }, []);

  // A different product loaded in this tab — drop the previous product's
  // fetched review list so it doesn't bleed across pages.
  useEffect(() => {
    setScanResult(undefined);
  }, [state.product?.asin]);

  // The background pushes fresh state right after it re-extracts the product
  // for this page, so the overlay reflects it even if SHOPIQ_GET_STATE above
  // happened to run first.
  useEffect(() => {
    function handleMessage(message: ExtensionMessage) {
      if (message.type === "SHOPIQ_STATE") setState(message.state);
    }

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  useEffect(() => {
    if (state.status !== "opening-reviews" && state.status !== "analyzing") return undefined;

    const intervalId = window.setInterval(() => {
      void refreshState();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [state.status]);

  return {
    state,
    ui,
    scanResult,
    scanning,
    scanProgress,
    setUi,
    refreshState,
    analyzeSnapshot,
    analyzeMoreReviews
  };
}
