import type { PriceComparison } from "../../../shared/types";

/**
 * Persistence seam for price comparisons. Ported from the backend, but backed by
 * `chrome.storage.local` instead of an in-process Map — so the cache is
 * per-user, shared across this user's tabs, and survives service-worker
 * restarts. The pricing service depends only on the `PriceStore` interface.
 */
export interface PriceStore {
  /** Returns a non-expired comparison for `key`, or null on miss/expiry. */
  get(key: string): Promise<PriceComparison | null>;
  /** Persists a freshly scraped comparison under `key`. */
  set(key: string, comparison: PriceComparison): Promise<void>;
}

/** How long a scraped comparison stays fresh before we re-scrape. */
export const PRICE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const CACHE_PREFIX = "shopiq:price:";

/** Normalises title + category into a stable cache key (category changes which
 * retailers are searched, so it's part of the key). */
export function priceCacheKey(title: string, categoryAlias = "all"): string {
  return `${categoryAlias}::${title.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

type Entry = { comparison: PriceComparison; expiresAt: number };

/** `chrome.storage.local`-backed TTL store. */
export class ChromeStoragePriceStore implements PriceStore {
  async get(key: string): Promise<PriceComparison | null> {
    const storageKey = CACHE_PREFIX + key;
    const stored = await chrome.storage.local.get(storageKey);
    const entry = stored[storageKey] as Entry | undefined;
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      await chrome.storage.local.remove(storageKey);
      return null;
    }
    return entry.comparison;
  }

  async set(key: string, comparison: PriceComparison): Promise<void> {
    const storageKey = CACHE_PREFIX + key;
    await chrome.storage.local.set({
      [storageKey]: { comparison, expiresAt: Date.now() + PRICE_CACHE_TTL_MS }
    });
  }
}

/** The store the pricing service reads/writes. */
export const priceStore: PriceStore = new ChromeStoragePriceStore();
