import {
  extractAmazonProduct,
  extractAmazonReviewPageReviews,
  isAmazonProductPage,
  isAmazonReviewPage
} from "./amazon";
import { mountOverlay } from "./overlay-mount";
import { applySponsored } from "./remove-sponsored";
import {
  HIDE_SPONSORED_STORAGE_KEY,
  SPONSORED_COUNTER_KEY,
  SPONSORED_MODE_KEY,
  type SponsoredMode
} from "../shared/constants";
import type { ExtensionMessage } from "../shared/types";
import { getConfig } from "../config";

/**
 * Fire-and-forget message to the background that tolerates a torn-down
 * extension context. Once the extension is reloaded/updated while this tab
 * stays open, `chrome.runtime.sendMessage` starts throwing "Extension context
 * invalidated" (synchronously) or rejecting (no receiver). These sends are all
 * best-effort — the background re-derives state on the next interaction — so we
 * swallow the failure rather than spam the console or break the scan flow.
 */
function safeSendMessage(message: ExtensionMessage): Promise<unknown> {
  try {
    return Promise.resolve(chrome.runtime.sendMessage(message)).catch(() => undefined);
  } catch {
    return Promise.resolve(undefined);
  }
}

let lastProductKey = "";
let lastReviewBatchKey = "";
// "idle"    - haven't decided what to do with this review page yet
// "running" - a scan or the ready-check is mid-flight
// "scanned" - a deep scan finished; we're navigating back to the product page,
//             so do nothing more (crucially, never send visible reviews)
// "done"    - a manual review-page visit; keep picking up lazily-loaded reviews
let reviewScanState: "idle" | "running" | "scanned" | "done" = "idle";
let pageLoadHandled = false;
let sponsoredMode: SponsoredMode = "off";
let showCounter = false;
// True while ShopIQ is modifying the DOM for sponsored handling — prevents
// the MutationObserver from re-triggering extractAndSend in a flicker loop.
let sponsoredMutating = false;

function runApplySponsored() {
  sponsoredMutating = true;
  applySponsored(sponsoredMode, showCounter);
  // MutationObserver callbacks fire as microtasks; setTimeout(0) runs after
  // them, so the flag is still true when the observer fires and clears after.
  window.setTimeout(() => { sponsoredMutating = false; }, 0);
}

mountOverlay();

const contentReady = (async () => {
  const stored = await chrome.storage.local.get([SPONSORED_MODE_KEY, SPONSORED_COUNTER_KEY, HIDE_SPONSORED_STORAGE_KEY]);
  const savedMode = stored[SPONSORED_MODE_KEY] as SponsoredMode | undefined;
  // backward compat: old boolean toggle maps to "cover"
  sponsoredMode = savedMode ?? (stored[HIDE_SPONSORED_STORAGE_KEY] ? "cover" : "off");
  showCounter = Boolean(stored[SPONSORED_COUNTER_KEY]);
  runApplySponsored();
  await extractAndSend();
})();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  let changed = false;
  if (SPONSORED_MODE_KEY in changes) {
    sponsoredMode = (changes[SPONSORED_MODE_KEY].newValue as SponsoredMode) ?? "off";
    changed = true;
  }
  if (SPONSORED_COUNTER_KEY in changes) {
    showCounter = Boolean(changes[SPONSORED_COUNTER_KEY].newValue);
    changed = true;
  }
  if (changed) runApplySponsored();
});

type ReviewPageReadyResponse = { scanning: boolean; extraPages: number };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function countReviews(): number {
  return document.querySelectorAll(getConfig().amazon.selectors.reviewItems).length;
}

/** Polls `predicate` until it's true or we run out of tries. */
async function waitUntil(predicate: () => boolean, tries = 30, intervalMs = 200): Promise<boolean> {
  for (let i = 0; i < tries; i += 1) {
    if (predicate()) return true;
    await sleep(intervalMs);
  }
  return predicate();
}

/**
 * Drives a deeper review scan: Amazon's review pages load the next batch via a
 * "Show 10 more reviews" button that AJAX-appends into the same DOM (the page
 * never reloads). So we click it `extraPages` times — waiting for each batch to
 * append — then scrape everything accumulated and hand it to the background.
 */
async function runReviewScan(extraPages: number): Promise<void> {
  await waitUntil(() => countReviews() > 0, 25);

  for (let page = 0; page < extraPages; page += 1) {
    const button = document.querySelector<HTMLElement>(getConfig().amazon.selectors.showMoreReviewsButton);
    if (!button) break; // no further pages available

    const before = countReviews();
    button.click();
    const grew = await waitUntil(() => countReviews() > before, 30);
    void safeSendMessage({ type: "SHOPIQ_REVIEW_SCAN_PROGRESS", page: page + 2 });
    if (!grew) break; // Amazon stopped returning more — stop early
  }

  void safeSendMessage({
    type: "SHOPIQ_REVIEW_BATCH_EXTRACTED",
    reviews: extractAmazonReviewPageReviews(),
    pageUrl: window.location.href
  });
}

/** Sends the reviews currently visible on a manually-opened review page (no scan running). */
function sendVisibleReviews(): void {
  const reviews = extractAmazonReviewPageReviews();
  if (reviews.length === 0) return;

  const reviewBatchKey = `${window.location.href}:${reviews.map((review) => review.body).join("|")}`;
  if (reviewBatchKey === lastReviewBatchKey) return;
  lastReviewBatchKey = reviewBatchKey;

  void safeSendMessage({
    type: "SHOPIQ_REVIEW_BATCH_EXTRACTED",
    reviews,
    pageUrl: window.location.href
  });
}

/** Decides, once per review-page load, whether to run a scan or just scrape what's visible. */
async function handleReviewPage(): Promise<void> {
  // "running" = a scan/ready-check is in flight; "scanned" = a deep scan
  // already completed and we're navigating back to the product page. In both
  // cases do nothing more — in particular never fall through to
  // sendVisibleReviews() below. After a scan, the background has already
  // cleared the scan, so that stray batch would hit the manual-merge path and
  // pollute the product's own reviews/analysis (and overwrite the
  // "opening-reviews" status the return navigation relies on).
  if (reviewScanState === "running" || reviewScanState === "scanned") return;

  if (reviewScanState === "idle") {
    reviewScanState = "running";
    let response: ReviewPageReadyResponse | undefined;
    try {
      response = await chrome.runtime.sendMessage({ type: "SHOPIQ_REVIEW_PAGE_READY" });
    } catch {
      response = undefined;
    }

    if (response?.scanning) {
      await runReviewScan(response.extraPages);
      reviewScanState = "scanned";
      return;
    }

    reviewScanState = "done";
  }

  sendVisibleReviews();
}

// Mount on every Amazon India page so the launcher is always reachable;
// non-PDP pages fall back to the overlay's empty state.
async function extractAndSend(): Promise<void> {
  runApplySponsored();

  const isProductOrReviewPage = isAmazonProductPage() || isAmazonReviewPage();

  // Once per page load, tell the background this page just loaded so it can
  // drop any state left over from a previous page in this tab. ui.open is
  // always page-specific (cleared here, then re-derived from the auto-open
  // setting for product pages); product/analysis state is only cleared on
  // non-product pages, since product pages immediately re-extract below.
  if (!pageLoadHandled) {
    pageLoadHandled = true;
    // Awaited so the background processes the page-load (and resets stale
    // per-tab state) before the product extraction below — but via safeSend so
    // a torn-down context can't stop the overlay from mounting.
    await safeSendMessage(
      isProductOrReviewPage
        ? { type: "SHOPIQ_PAGE_LOADED", isProductPage: isAmazonProductPage() }
        : { type: "SHOPIQ_NON_PRODUCT_PAGE" }
    );
  }

  if (isProductOrReviewPage) {
    mountOverlay();

    if (isAmazonProductPage()) {
      const product = extractAmazonProduct();
      if (!product) return;

      const productKey = `${product.url}:${product.title}:${product.reviews.map((review) => review.body).join("|")}`;
      if (productKey === lastProductKey) return;
      lastProductKey = productKey;

      void safeSendMessage({
        type: "SHOPIQ_PRODUCT_EXTRACTED",
        product
      });
      return;
    }

    void handleReviewPage();
    return;
  }

  mountOverlay();
}

void contentReady;

// Coalesce bursts of DOM mutations into a single scan. Without this, every
// mutation batch queued its own extractAndSend — and while Amazon's AI streams
// (hundreds of node insertions a second), that flooded the main thread with
// full-page `querySelectorAll`s and froze both the page and the overlay.
let pendingScan: number | undefined;
const observer = new MutationObserver(() => {
  if (sponsoredMutating) return;
  if (pendingScan !== undefined) window.clearTimeout(pendingScan);
  pendingScan = window.setTimeout(() => {
    pendingScan = undefined;
    void extractAndSend();
  }, 400);
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});
