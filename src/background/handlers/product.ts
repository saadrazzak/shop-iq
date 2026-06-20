import type { ProductState } from "../../shared/types";
import { analyzeAndStore } from "../api";
import { mergeProductReviews } from "../lib/reviews";
import {
  DEFAULT_UI,
  clearReviewScan,
  clearScanResult,
  getProductState,
  getReviewScan,
  maybeAutoOpenOverlay,
  openOverlay,
  setOverlayUi,
  setProductState
} from "../state";
import type { HandlerContext, MessageOf } from "./types";

/** A product page extracted its data: merge reviews, analyze, and push the result to the overlay. */
export async function handleProductExtracted(
  ctx: HandlerContext,
  message: MessageOf<"SHOPIQ_PRODUCT_EXTRACTED">
): Promise<void> {
  const { tabId, sendResponse } = ctx;
  const current = await getProductState(tabId);
  const sameProduct = Boolean(current?.product && current.product.asin === message.product.asin);
  // A different product invalidates the previous scan's filtered reviews.
  if (!sameProduct) await clearScanResult(tabId);
  const existingReviews = sameProduct && current?.product ? current.product.reviews : [];
  const product = mergeProductReviews({
    ...message.product,
    reviews: [...existingReviews, ...message.product.reviews]
  });
  let state: ProductState = {
    status: "product-found",
    product,
    analysis: sameProduct ? current?.analysis : undefined
  };
  await setProductState(tabId, state);

  if (product.reviews.length > 0) {
    try {
      state = await analyzeAndStore(tabId, product);
    } catch {
      // Analysis backend unreachable (server down / no internet). Keep the
      // product-found state — the on-page data (rating, aspects, reviews) still
      // renders — but record the failure so the Reviews tab can surface it.
      state = await setProductState(tabId, {
        ...state,
        error: "Couldn't reach the analysis service — showing on-page data only."
      });
    }
  }

  try {
    await chrome.tabs.sendMessage(tabId, { type: "SHOPIQ_STATE", state });
  } catch {
    // The overlay may not be mounted yet; its initial SHOPIQ_GET_STATE
    // fetch will pick up this state once it mounts.
  }

  sendResponse({ state });
}

/** A page finished loading: decide whether the overlay should open and on which tab. */
export async function handlePageLoaded(
  ctx: HandlerContext,
  message: MessageOf<"SHOPIQ_PAGE_LOADED">
): Promise<void> {
  const { tabId, sendResponse } = ctx;
  // ui.open is page-specific: only an in-flight review scan - either the
  // navigation to the review page, or the return trip back to the
  // product page once it's done (signalled by "opening-reviews") -
  // carries it across a page load. Otherwise every fresh page starts
  // closed, and the auto-open setting is re-evaluated for product pages.
  const scan = await getReviewScan(tabId);
  const current = await getProductState(tabId);
  const returningFromScan = current?.status === "opening-reviews";

  if (!scan && !returningFromScan) {
    await setOverlayUi(tabId, DEFAULT_UI);
    if (message.isProductPage) await maybeAutoOpenOverlay(tabId);
  } else if (!scan && returningFromScan) {
    // The return trip from the review page: re-assert the overlay open on
    // the Reviews tab rather than relying on the persisted ui surviving
    // the round trip untouched, and nudge it to show immediately.
    await openOverlay(tabId, { open: true, activeTab: "reviews" });
  }

  sendResponse({ ok: true });
}

/** A non-product page loaded: clear any product/overlay state left over in this tab. */
export async function handleNonProductPage(ctx: HandlerContext): Promise<void> {
  const { tabId, sendResponse } = ctx;
  // Drop any product/overlay state left over from a product page visited
  // earlier in this tab - it no longer applies to the page now loaded.
  await setProductState(tabId, { status: "idle" });
  await clearScanResult(tabId);
  await clearReviewScan(tabId);
  await setOverlayUi(tabId, DEFAULT_UI);
  sendResponse({ ok: true });
}
