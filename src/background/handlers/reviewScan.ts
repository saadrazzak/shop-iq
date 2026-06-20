import type { ProductState } from "../../shared/types";
import { getConfig } from "../../config";
import { analyzeAndStore } from "../api";
import { buildReviewUrl } from "../../shared/reviewUrl";
import { mergeProductReviews } from "../lib/reviews";
import {
  clearReviewScan,
  getProductState,
  getReviewScan,
  setOverlayUi,
  setProductState,
  setReviewScan,
  setScanResult
} from "../state";
import type { HandlerContext, MessageOf } from "./types";

/** "Analyze more reviews" was triggered: record the scan and navigate the tab to the review page. */
export async function handleOpenReviewPage(
  ctx: HandlerContext,
  message: MessageOf<"SHOPIQ_OPEN_REVIEW_PAGE">
): Promise<void> {
  const { tabId, sender, sendResponse } = ctx;
  const current = await getProductState(tabId);
  const asin = current?.product?.asin;

  if (!asin) {
    const state: ProductState = {
      status: "error",
      product: current?.product,
      error: "ASIN was not found, so ShopIQ cannot open the review page."
    };
    await setProductState(tabId, state);
    sendResponse({ state });
    return;
  }

  const options = message.options;
  // Where to land once the scan finishes — the product page the user came from.
  const returnUrl = current.product?.url ?? sender.tab?.url;
  await setReviewScan(tabId, { asin, options, returnUrl });
  // Keep the overlay open (on the Reviews tab) through the scan's navigations.
  await setOverlayUi(tabId, { open: true, activeTab: "reviews" });
  const state: ProductState = {
    status: "opening-reviews",
    product: current.product,
    analysis: current.analysis,
    scanProgress: { page: 1, pageLimit: getConfig().thresholds.reviewScanPageLimit }
  };
  await setProductState(tabId, state);
  await chrome.tabs.update(tabId, { url: buildReviewUrl(asin, options) });
  sendResponse({ state });
}

/** The review page is ready: tell the content script whether a scan is queued and how many pages to crawl. */
export async function handleReviewPageReady(ctx: HandlerContext): Promise<void> {
  const { tabId, sendResponse } = ctx;
  const scan = await getReviewScan(tabId);
  if (scan && !scan.started) {
    await setReviewScan(tabId, { ...scan, started: true });
    sendResponse({ scanning: true, extraPages: Math.max(0, getConfig().thresholds.reviewScanPageLimit - 1) });
    return;
  }
  sendResponse({ scanning: false, extraPages: 0 });
}

/**
 * A batch of reviews was scraped from the review page. Two paths:
 *  - SCAN: store the filtered reviews for the Reviews tab and navigate back to
 *    the product page (the analysis/buy-score stays anchored to the product's
 *    own reviews — never these).
 *  - MANUAL (no scan running): merge the visible reviews into the analyzed set.
 */
export async function handleReviewBatchExtracted(
  ctx: HandlerContext,
  message: MessageOf<"SHOPIQ_REVIEW_BATCH_EXTRACTED">
): Promise<void> {
  const { tabId, sendResponse } = ctx;
  const current = await getProductState(tabId);
  const product = current?.product;

  if (!product) {
    const state: ProductState = {
      status: "error",
      error: "Review page opened, but the original product data was not found."
    };
    await setProductState(tabId, state);
    sendResponse({ state });
    return;
  }

  const scan = await getReviewScan(tabId);

  // SCAN path: fetch-for-display only. The filtered reviews become the
  // Reviews-tab set but never feed the analysis/buy-score — that stays
  // anchored to the product page's own reviews.
  if (scan) {
    await setScanResult(tabId, { reviews: message.reviews, options: scan.options });
    await clearReviewScan(tabId);

    const returnStatus: ProductState["status"] = current.analysis ? "complete" : "product-found";
    if (scan.returnUrl) {
      await setProductState(tabId, { ...current, status: "opening-reviews", scanProgress: undefined });
      await chrome.tabs.update(tabId, { url: scan.returnUrl });
    } else {
      await setProductState(tabId, { ...current, status: returnStatus, scanProgress: undefined });
    }
    sendResponse({ state: await getProductState(tabId) });
    return;
  }

  // Defense-in-depth: a "scan finished, navigating back" status means any
  // no-scan batch arriving now is a stray send from the defunct review page
  // (its scan was just cleared). Ignore it so it can't merge review-page
  // reviews into the product's own set or overwrite the return status the
  // overlay's auto-reopen relies on.
  if (current.status === "opening-reviews") {
    sendResponse({ state: current });
    return;
  }

  // MANUAL review-page visit (no scan running): keep the original behavior
  // of merging visible reviews into the analyzed set.
  if (message.reviews.length === 0) {
    sendResponse({ state: current });
    return;
  }

  const mergedProduct = mergeProductReviews({
    ...product,
    reviews: [...product.reviews, ...message.reviews]
  });

  try {
    await setProductState(tabId, {
      status: "analyzing",
      product: mergedProduct,
      analysis: current.analysis
    });
    sendResponse({ state: await analyzeAndStore(tabId, mergedProduct) });
  } catch (error) {
    const state: ProductState = {
      status: "error",
      product: mergedProduct,
      error: error instanceof Error ? error.message : "Unknown review analysis error."
    };
    await setProductState(tabId, state);
    sendResponse({ state });
  }
}

/** Updates the in-flight scan's page progress for the Reviews-tab status line. */
export async function handleReviewScanProgress(
  ctx: HandlerContext,
  message: MessageOf<"SHOPIQ_REVIEW_SCAN_PROGRESS">
): Promise<void> {
  const { tabId, sendResponse } = ctx;
  const state = await getProductState(tabId);
  if (state) {
    await setProductState(tabId, {
      ...state,
      scanProgress: { page: message.page, pageLimit: getConfig().thresholds.reviewScanPageLimit }
    });
  }
  sendResponse({ ok: true });
}
