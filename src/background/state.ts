import { AUTO_OPEN_STORAGE_KEY } from "../shared/constants";
import type { OverlayUi, ProductState, ReviewScanOptions, ScanResult } from "../shared/types";

/**
 * An in-flight deeper review scan. `returnUrl` is the product page to navigate
 * back to when the scan finishes; `started` guards against the content script
 * kicking off the same scan twice.
 */
export type ReviewScan = { asin: string; options: ReviewScanOptions; returnUrl?: string; started?: boolean };

export const DEFAULT_UI: OverlayUi = { open: false, activeTab: "summary" };

// Per-tab state lives in these in-memory Maps for fast access, mirrored into
// chrome.storage.session so it survives the service worker being torn down
// (and, crucially, the review scan's two page navigations). Getters are
// cache-first and fall back to session storage; setters write both.
const stateByTab = new Map<number, ProductState>();
const reviewScanByTab = new Map<number, ReviewScan>();
const uiByTab = new Map<number, OverlayUi>();
// The most recent scan's fetched reviews + the filter used. Kept separate from
// ProductState so it survives the navigation back to the product page and is
// the only review set shown after a scan.
const scanResultByTab = new Map<number, ScanResult>();

function stateKey(tabId: number): string {
  return `shopiq:state:${tabId}`;
}

function scanKey(tabId: number): string {
  return `shopiq:scan:${tabId}`;
}

function uiKey(tabId: number): string {
  return `shopiq:ui:${tabId}`;
}

function scanResultKey(tabId: number): string {
  return `shopiq:scanresult:${tabId}`;
}

export async function getProductState(tabId: number): Promise<ProductState | undefined> {
  const cached = stateByTab.get(tabId);
  if (cached) return cached;

  const stored = await chrome.storage.session.get(stateKey(tabId));
  const state = stored[stateKey(tabId)] as ProductState | undefined;
  if (state) stateByTab.set(tabId, state);
  return state;
}

export async function setProductState(tabId: number, state: ProductState): Promise<ProductState> {
  stateByTab.set(tabId, state);
  await chrome.storage.session.set({ [stateKey(tabId)]: state });
  return state;
}

export async function getReviewScan(tabId: number): Promise<ReviewScan | undefined> {
  const cached = reviewScanByTab.get(tabId);
  if (cached) return cached;

  const stored = await chrome.storage.session.get(scanKey(tabId));
  const scan = stored[scanKey(tabId)] as ReviewScan | undefined;
  if (scan) reviewScanByTab.set(tabId, scan);
  return scan;
}

export async function setReviewScan(tabId: number, scan: ReviewScan): Promise<void> {
  reviewScanByTab.set(tabId, scan);
  await chrome.storage.session.set({ [scanKey(tabId)]: scan });
}

export async function clearReviewScan(tabId: number): Promise<void> {
  reviewScanByTab.delete(tabId);
  await chrome.storage.session.remove(scanKey(tabId));
}

export async function getOverlayUi(tabId: number): Promise<OverlayUi> {
  const cached = uiByTab.get(tabId);
  if (cached) return cached;

  const stored = await chrome.storage.session.get(uiKey(tabId));
  const ui = (stored[uiKey(tabId)] as OverlayUi | undefined) ?? DEFAULT_UI;
  uiByTab.set(tabId, ui);
  return ui;
}

export async function setOverlayUi(tabId: number, patch: Partial<OverlayUi>): Promise<OverlayUi> {
  const next: OverlayUi = { ...(await getOverlayUi(tabId)), ...patch };
  uiByTab.set(tabId, next);
  await chrome.storage.session.set({ [uiKey(tabId)]: next });
  return next;
}

export async function getScanResult(tabId: number): Promise<ScanResult | undefined> {
  const cached = scanResultByTab.get(tabId);
  if (cached) return cached;

  const stored = await chrome.storage.session.get(scanResultKey(tabId));
  const result = stored[scanResultKey(tabId)] as ScanResult | undefined;
  if (result) scanResultByTab.set(tabId, result);
  return result;
}

export async function setScanResult(tabId: number, result: ScanResult): Promise<void> {
  scanResultByTab.set(tabId, result);
  await chrome.storage.session.set({ [scanResultKey(tabId)]: result });
}

export async function clearScanResult(tabId: number): Promise<void> {
  scanResultByTab.delete(tabId);
  await chrome.storage.session.remove(scanResultKey(tabId));
}

/** Drops every per-tab record (memory + session storage) when a tab closes. */
export function clearTabState(tabId: number): void {
  stateByTab.delete(tabId);
  reviewScanByTab.delete(tabId);
  uiByTab.delete(tabId);
  scanResultByTab.delete(tabId);
  void chrome.storage.session.remove([stateKey(tabId), scanKey(tabId), uiKey(tabId), scanResultKey(tabId)]);
}

export async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

/** Persists the overlay UI patch, then best-effort nudges an already-mounted overlay to show it immediately. */
export async function openOverlay(tabId: number, uiPatch: Partial<OverlayUi>): Promise<void> {
  await setOverlayUi(tabId, uiPatch);
  try {
    await chrome.tabs.sendMessage(tabId, { type: "SHOPIQ_SHOW_OVERLAY" });
  } catch {
    // The content script may not be ready yet; the persisted ui.open above
    // still makes the overlay open once useProductState's initial fetch runs.
  }
}

/** Opens the overlay on first product detection if the user has chosen auto-open in the popup. */
export async function maybeAutoOpenOverlay(tabId: number): Promise<void> {
  const stored = await chrome.storage.local.get(AUTO_OPEN_STORAGE_KEY);
  if (!stored[AUTO_OPEN_STORAGE_KEY]) return;

  await openOverlay(tabId, { open: true });
}
