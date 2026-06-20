import { PALETTE } from "./palette";
import { getConfig } from "../../config";


const ASPECT_PANEL_OPEN_DELAY_MS = 350;

/**
 * Inline styles (applied with `!important` so Amazon's own CSS can't win)
 * that lift a live-page element out of the flow and into a centered floating
 * overlay. Shared by the "Customers say" bottom-sheet and the individual
 * review highlights so both float in the same spot with the same chrome.
 */
const PAGE_OVERLAY_STYLES: ReadonlyArray<readonly [string, string]> = [
  ["position", "fixed"],
  ["top", "25%"],
  ["right", "35%"],
  ["z-index", "999"],
  ["background", "white"],
  ["padding", "16px"],
  ["border-radius", "8px"],
  ["box-shadow", "0px 6px 12px rgb(0 0 0 / 47%)"],
  ["width", "50%"]
];

/** CSS property used for the overlay's colored accent edge. */
const OVERLAY_ACCENT_PROPERTY = "border-top";
const OVERLAY_ACCENT_WIDTH = "6px";

/** Default accent color when the caller doesn't tie the overlay to a specific rating/sentiment. */
const DEFAULT_OVERLAY_ACCENT = PALETTE.brand;

/** Turns an element into the floating overlay (see `PAGE_OVERLAY_STYLES`), with a colored top edge indicating the related rating/sentiment. */
function applyOverlayStyles(element: HTMLElement, accentColor: string = DEFAULT_OVERLAY_ACCENT): void {
  for (const [property, value] of PAGE_OVERLAY_STYLES) {
    element.style.setProperty(property, value, "important");
  }
  element.style.setProperty(
    OVERLAY_ACCENT_PROPERTY,
    `${OVERLAY_ACCENT_WIDTH} solid ${accentColor}`,
    "important"
  );
}

/** Reverts an element back to its normal in-page position and styling. */
function clearOverlayStyles(element: HTMLElement): void {
  for (const [property] of PAGE_OVERLAY_STYLES) {
    element.style.removeProperty(property);
  }
  element.style.removeProperty(OVERLAY_ACCENT_PROPERTY);
}

const SCRIM_ID = "shopiq-page-overlay-scrim";
/** Closes whatever click-triggered overlay the scrim currently sits behind. */
let scrimCloseHandler: (() => void) | null = null;

/**
 * Dims the page behind a floated Amazon element (sits at z 998, just under the
 * floated element's z 999). Clicking it closes the overlay via `onClose`, which
 * also lets the React caller sync its own active state.
 */
function showScrim(onClose: () => void): void {
  scrimCloseHandler = onClose;
  if (document.getElementById(SCRIM_ID)) return;

  const scrim = document.createElement("div");
  scrim.id = SCRIM_ID;
  scrim.style.cssText =
    "position:fixed; inset:0; z-index:998; background:rgba(31,41,55,0.55); cursor:pointer;";
  scrim.addEventListener("click", () => scrimCloseHandler?.());
  document.body.appendChild(scrim);
}

function hideScrim(): void {
  scrimCloseHandler = null;
  document.getElementById(SCRIM_ID)?.remove();
}

const REVIEW_CLOSE_BTN_ID = "shopiq-review-close-btn";

function injectCloseButton(element: HTMLElement, onClose: () => void): void {
  element.querySelector(`#${REVIEW_CLOSE_BTN_ID}`)?.remove();

  const btn = document.createElement("button");
  btn.id = REVIEW_CLOSE_BTN_ID;
  btn.type = "button";
  btn.setAttribute("aria-label", "Close review");
  btn.style.cssText =
    "position:absolute!important;top:8px!important;right:8px!important;" +
    "width:24px!important;height:24px!important;border-radius:50%!important;" +
    "border:none!important;background:rgba(0,0,0,0.08)!important;cursor:pointer!important;" +
    "display:flex!important;align-items:center!important;justify-content:center!important;" +
    "z-index:1000!important;padding:0!important;";
  btn.innerHTML =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M18 6 6 18M6 6l12 12"/></svg>';
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    onClose();
  });

  // Ensure the review element can contain an absolutely-positioned child.
  if (getComputedStyle(element).position === "static") {
    element.style.setProperty("position", "relative", "important");
  }
  element.appendChild(btn);
}

function removeCloseButton(element: HTMLElement): void {
  element.querySelector(`#${REVIEW_CLOSE_BTN_ID}`)?.remove();
}

function getBottomSheet(): HTMLElement | null {
  return document.querySelector(getConfig().amazon.pageOverlay.bottomSheet);
}

/**
 * Clicks the matching "Customers say" aspect tab on the live product page —
 * the same control Amazon uses to load and reveal reviews mentioning that
 * aspect — then turns the bottom-sheet panel Amazon expands with the
 * matching reviews into a floating overlay.
 */
export function activateAspectAndOverlay(
  ariaControls: string,
  accentColor?: string,
  onClose?: () => void
): void {
  const tab = document.querySelector(
    `${getConfig().amazon.pageOverlay.aspectTabBase}[aria-controls="${CSS.escape(ariaControls)}"]`
  );
  if (!tab) return;

  const trigger = (tab.querySelector("button") ?? tab) as HTMLElement;
  trigger.click();

  showScrim(() => {
    deactivateAspectOverlay();
    onClose?.();
  });

  // Wait for Amazon's click handler to expand the panel before overlaying it.
  window.setTimeout(() => {
    const bottomSheet = getBottomSheet();
    if (bottomSheet) applyOverlayStyles(bottomSheet, accentColor);
  }, ASPECT_PANEL_OPEN_DELAY_MS);
}

/** Reverts the "Customers say" bottom-sheet back to its in-page position. */
export function deactivateAspectOverlay(): void {
  const bottomSheet = getBottomSheet();
  if (bottomSheet) clearOverlayStyles(bottomSheet);
  hideScrim();
}

/**
 * Lifts a single review (by its element id) out of the page into a floating
 * overlay and injects a close button. `onClose` is called when the close
 * button is clicked, so the caller can sync its own state.
 */
export function activateReviewOverlay(domId: string, accentColor?: string, onClose?: () => void): void {
  const review = document.getElementById(domId);
  if (!review) return;
  applyOverlayStyles(review, accentColor);
  const close = () => {
    deactivateReviewOverlay(domId);
    onClose?.();
  };
  injectCloseButton(review, close);
  showScrim(close);
}

/** Reverts a review lifted by `activateReviewOverlay` back into the page and removes the close button. */
export function deactivateReviewOverlay(domId: string): void {
  const review = document.getElementById(domId);
  if (!review) return;
  clearOverlayStyles(review);
  removeCloseButton(review);
  hideScrim();
}

/** Narrower/more-right-aligned variant of `PAGE_OVERLAY_STYLES` for the reviews overlay, so it doesn't cover the rating being hovered. */
const REVIEWS_OVERLAY_STYLE_OVERRIDES: ReadonlyArray<readonly [string, string]> = [
  ["right", "45%"],
  ["width", "25%"]
];

/** How long the pointer must stay over the trigger before the reviews overlay appears — avoids popping it open on accidental/passing hovers. */
const REVIEWS_OVERLAY_SHOW_DELAY_MS = 300;

/** How long the reviews overlay (see below) lingers after the pointer leaves it before hiding. */
const REVIEWS_OVERLAY_HIDE_DELAY_MS = 1000;

let reviewsOverlayShowTimeout: number | undefined;
let reviewsOverlayHideTimeout: number | undefined;
let reviewsOverlayListenersAttached = false;

function getReviewsContainer(): HTMLElement | null {
  return document.querySelector(getConfig().amazon.pageOverlay.reviewsContainer);
}

function cancelReviewsOverlayShow(): void {
  if (reviewsOverlayShowTimeout !== undefined) {
    window.clearTimeout(reviewsOverlayShowTimeout);
    reviewsOverlayShowTimeout = undefined;
  }
}

function cancelReviewsOverlayHide(): void {
  if (reviewsOverlayHideTimeout !== undefined) {
    window.clearTimeout(reviewsOverlayHideTimeout);
    reviewsOverlayHideTimeout = undefined;
  }
}

/**
 * Lifts Amazon's customer-reviews section into the floating overlay so the
 * user can sanity-check the rating/score without losing their place. Waits
 * `REVIEWS_OVERLAY_SHOW_DELAY_MS` before actually showing it — `scheduleHideReviewsOverlay`
 * cancels this if the pointer leaves first, so a quick pass over the rating
 * doesn't pop the overlay open. Attaches hover listeners to the live container
 * itself, so interacting with Amazon's own controls inside it (e.g. clicking a
 * star-rating filter) keeps the overlay open.
 */
export function showReviewsOverlay(): void {
  cancelReviewsOverlayHide();
  cancelReviewsOverlayShow();

  reviewsOverlayShowTimeout = window.setTimeout(() => {
    reviewsOverlayShowTimeout = undefined;

    const container = getReviewsContainer();
    if (!container) return;

    applyOverlayStyles(container);
    for (const [property, value] of REVIEWS_OVERLAY_STYLE_OVERRIDES) {
      container.style.setProperty(property, value, "important");
    }

    if (!reviewsOverlayListenersAttached) {
      container.addEventListener("mouseenter", cancelReviewsOverlayHide);
      container.addEventListener("mouseleave", scheduleHideReviewsOverlay);
      reviewsOverlayListenersAttached = true;
    }
  }, REVIEWS_OVERLAY_SHOW_DELAY_MS);
}

/** Hides the reviews overlay after a short grace period (cancelled by re-hovering it or its trigger). Also cancels a pending `showReviewsOverlay` that hasn't fired yet. */
export function scheduleHideReviewsOverlay(): void {
  cancelReviewsOverlayShow();
  cancelReviewsOverlayHide();
  reviewsOverlayHideTimeout = window.setTimeout(() => {
    const container = getReviewsContainer();
    if (!container) return;

    clearOverlayStyles(container);
    container.removeEventListener("mouseenter", cancelReviewsOverlayHide);
    container.removeEventListener("mouseleave", scheduleHideReviewsOverlay);
    reviewsOverlayListenersAttached = false;
  }, REVIEWS_OVERLAY_HIDE_DELAY_MS);
}

/** Max time (ms) to wait for the photo gallery popover to appear after clicking. */
const ALL_PHOTOS_WATCH_TIMEOUT_MS = 4000;

function applyPhotosGalleryStyles(): void {
  const popover = document.querySelector<HTMLElement>(getConfig().amazon.pageOverlay.allPhotosPopover);
  if (!popover) return;
  popover.style.setProperty("left", "-10%", "important");
  popover.style.setProperty("width", "55%", "important");
}

/**
 * Clicks Amazon's "See all photos" link (inside the review image carousel),
 * constrains the popover to the left side of the viewport, dims the page with
 * the shared scrim, and calls `onDone` when the gallery is dismissed — either
 * by clicking Amazon's own close button or by clicking the scrim.
 */
export function openAllPhotosGallery(onDone?: () => void): void {
  const trigger = document.querySelector<HTMLElement>(getConfig().amazon.pageOverlay.allPhotosTrigger);
  if (!trigger) return;

  // Unified cleanup: hide scrim, remove the close-button listener, notify caller.
  let cleaned = false;
  const done = () => {
    if (cleaned) return;
    cleaned = true;
    hideScrim();
    document.removeEventListener("click", closeListener, true);
    onDone?.();
  };

  // Capture-phase listener so we catch Amazon's close button before its own
  // handler can remove the popover from the DOM.
  const closeSelector = getConfig().amazon.pageOverlay.allPhotosPopoverClose;
  const closeListener = (e: Event) => {
    if ((e.target as Element).closest(closeSelector)) done();
  };
  document.addEventListener("click", closeListener, true);

  // Dispatch a synthetic MouseEvent on the span so Amazon's data-mix-operations
  // handler fires. Avoid clicking the child <a href="javascript:void(0)"> directly
  // — that triggers a javascript: URL navigation which the extension CSP blocks.
  trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

  // Apply immediately in case the popover was already in the DOM (just hidden).
  applyPhotosGalleryStyles();

  // Show the shared backdrop; clicking it also counts as dismissing the gallery.
  showScrim(done);

  // Watch for the popover to be dynamically inserted or become visible.
  const observer = new MutationObserver(() => {
    applyPhotosGalleryStyles();
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });
  window.setTimeout(() => observer.disconnect(), ALL_PHOTOS_WATCH_TIMEOUT_MS);
}

/** Closes the Amazon photo gallery by clicking its own close button. */
export function closeAllPhotosGallery(): void {
  const closeBtn = document.querySelector<HTMLElement>(getConfig().amazon.pageOverlay.allPhotosPopoverClose);
  closeBtn?.click();
}
