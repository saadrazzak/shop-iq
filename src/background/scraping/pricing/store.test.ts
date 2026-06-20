import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChromeStoragePriceStore, PRICE_CACHE_TTL_MS, priceCacheKey } from "./store";
import type { PriceComparison } from "../../../shared/types";

function comparison(): PriceComparison {
  return { query: "q", prices: [], fetchedAt: "2026-06-15T00:00:00.000Z", cached: false };
}

// Replace the (stateless) global chrome.storage.local mock with a stateful one.
beforeEach(() => {
  const data: Record<string, unknown> = {};
  const local = chrome.storage.local as unknown as Record<string, ReturnType<typeof vi.fn>>;
  local.get = vi.fn(async (key: string) => (key in data ? { [key]: data[key] } : {}));
  local.set = vi.fn(async (items: Record<string, unknown>) => {
    Object.assign(data, items);
  });
  local.remove = vi.fn(async (key: string) => {
    delete data[key];
  });
});

afterEach(() => vi.useRealTimers());

describe("priceCacheKey", () => {
  it("normalizes whitespace/case and namespaces by category", () => {
    expect(priceCacheKey("  Sony   WH-1000XM5 ", "electronics")).toBe("electronics::sony wh-1000xm5");
    expect(priceCacheKey("Item")).toBe("all::item");
  });
});

describe("ChromeStoragePriceStore", () => {
  it("stores and returns a comparison before it expires", async () => {
    const store = new ChromeStoragePriceStore();
    await store.set("k", comparison());
    expect(await store.get("k")).not.toBeNull();
  });

  it("returns null for a missing key", async () => {
    expect(await new ChromeStoragePriceStore().get("absent")).toBeNull();
  });

  it("expires entries after the TTL", async () => {
    vi.useFakeTimers();
    const store = new ChromeStoragePriceStore();
    await store.set("k", comparison());

    vi.advanceTimersByTime(PRICE_CACHE_TTL_MS + 1);
    expect(await store.get("k")).toBeNull();
  });
});
