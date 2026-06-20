import { afterEach, describe, expect, it, vi } from "vitest";
import type { PriceResult } from "../../../shared/types";

// Isolate the service from real scraping + the real cache.
vi.mock("../scrapers", () => ({ comparePrices: vi.fn() }));
vi.mock("./store", () => ({
  priceStore: { get: vi.fn(), set: vi.fn() },
  priceCacheKey: (title: string, category?: string) => `${category ?? "all"}::${title}`
}));

import { comparePrices } from "../scrapers";
import { priceStore } from "./store";
import { getPriceComparison, toConfidenceBand } from "./service";

describe("toConfidenceBand", () => {
  it("maps a 0-1 score to high/medium/low bands", () => {
    expect(toConfidenceBand(0.9)).toBe("high");
    expect(toConfidenceBand(0.6)).toBe("high");
    expect(toConfidenceBand(0.55)).toBe("medium");
    expect(toConfidenceBand(0.4)).toBe("low");
  });
});

const mockedComparePrices = vi.mocked(comparePrices);
const mockedStore = vi.mocked(priceStore);

function result(overrides: Partial<PriceResult> = {}): PriceResult {
  return {
    source: "Croma",
    title: "Sony WH-1000XM5 Wireless Headphones",
    price: 1000,
    productUrl: "https://www.croma.com/x",
    confidenceScore: 0.8,
    ...overrides
  };
}

afterEach(() => vi.clearAllMocks());

describe("getPriceComparison", () => {
  it("serves a cache hit without scraping and marks it cached", async () => {
    mockedStore.get.mockResolvedValueOnce({ query: "q", prices: [], fetchedAt: "t", cached: false });

    const out = await getPriceComparison({ title: "Sony WH-1000XM5", url: "u" });

    expect(out.cached).toBe(true);
    expect(mockedComparePrices).not.toHaveBeenCalled();
  });

  it("drops low-confidence and out-of-sanity-band listings, then caches the rest", async () => {
    mockedStore.get.mockResolvedValueOnce(null);
    mockedComparePrices.mockResolvedValueOnce([
      result({ source: "Keep", confidenceScore: 0.8, price: 1000 }),
      result({ source: "LowConf", confidenceScore: 0.3, price: 1000 }), // dropped: low confidence
      result({ source: "TooCheap", confidenceScore: 0.9, price: 50 }) // dropped: < 0.2× Amazon price
    ]);

    const out = await getPriceComparison({ title: "Sony WH-1000XM5", url: "u", price: "₹1000" });

    expect(out.cached).toBe(false);
    expect(out.prices.map((p) => p.source)).toEqual(["Keep"]);
    expect(out.prices[0].confidence).toBe("high");
    expect(mockedStore.set).toHaveBeenCalledTimes(1);
  });

  it("bypasses the cache when forceRefresh is set", async () => {
    mockedComparePrices.mockResolvedValueOnce([]);

    await getPriceComparison({ title: "X", url: "u" }, { forceRefresh: true });

    expect(mockedStore.get).not.toHaveBeenCalled();
    expect(mockedComparePrices).toHaveBeenCalledTimes(1);
  });
});
