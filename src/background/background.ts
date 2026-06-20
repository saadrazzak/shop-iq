import type { ExtensionMessage, ProductState } from "../shared/types";
import { clearTabState, getActiveTabId } from "./state";
import { handleAnalyzeProduct, handleGetComparisons, handleGetPrices } from "./handlers/analysis";
import { handleGetState, handleSetUi } from "./handlers/overlay";
import { handleNonProductPage, handlePageLoaded, handleProductExtracted } from "./handlers/product";
import {
  handleOpenReviewPage,
  handleReviewBatchExtracted,
  handleReviewPageReady,
  handleReviewScanProgress
} from "./handlers/reviewScan";
import type { HandlerContext } from "./handlers/types";

// Forget a tab's product/overlay/scan state once it closes.
chrome.tabs.onRemoved.addListener((tabId) => clearTabState(tabId));

/**
 * Single message router. Every request from the content script, overlay, or
 * popup is dispatched here to a focused handler in ./handlers/*. Returning
 * `true` keeps the message channel open for the async `sendResponse`.
 */
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  void (async () => {
    const tabId = sender.tab?.id ?? (await getActiveTabId());
    if (!tabId) {
      sendResponse({ status: "error", error: "No active tab found." } satisfies ProductState);
      return;
    }

    const ctx: HandlerContext = { tabId, sender, sendResponse };

    switch (message.type) {
      case "SHOPIQ_PRODUCT_EXTRACTED":
        return handleProductExtracted(ctx, message);
      case "SHOPIQ_PAGE_LOADED":
        return handlePageLoaded(ctx, message);
      case "SHOPIQ_NON_PRODUCT_PAGE":
        return handleNonProductPage(ctx);
      case "SHOPIQ_REVIEW_BATCH_EXTRACTED":
        return handleReviewBatchExtracted(ctx, message);
      case "SHOPIQ_REVIEW_PAGE_READY":
        return handleReviewPageReady(ctx);
      case "SHOPIQ_REVIEW_SCAN_PROGRESS":
        return handleReviewScanProgress(ctx, message);
      case "SHOPIQ_GET_STATE":
        return handleGetState(ctx);
      case "SHOPIQ_SET_UI":
        return handleSetUi(ctx, message);
      case "SHOPIQ_OPEN_REVIEW_PAGE":
        return handleOpenReviewPage(ctx, message);
      case "SHOPIQ_ANALYZE_PRODUCT":
        return handleAnalyzeProduct(ctx, message);
      case "SHOPIQ_GET_COMPARISONS":
        return handleGetComparisons(ctx, message);
      case "SHOPIQ_GET_PRICES":
        return handleGetPrices(ctx, message);
      // SHOPIQ_STATE / SHOPIQ_SHOW_OVERLAY / SHOPIQ_COMPARISONS_RESULT are
      // background → content/overlay pushes; they never arrive here.
      default:
        return undefined;
    }
  })();

  return true;
});
