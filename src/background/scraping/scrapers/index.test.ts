import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./croma", () => ({ searchCroma: vi.fn().mockResolvedValue(null) }));
vi.mock("./reliance-digital", () => ({ searchRelianceDigital: vi.fn().mockResolvedValue(null) }));
vi.mock("./myntra", () => ({ searchMyntra: vi.fn().mockResolvedValue(null) }));
vi.mock("./ajio", () => ({ searchAjio: vi.fn().mockResolvedValue(null) }));
vi.mock("./meesho", () => ({ searchMeesho: vi.fn().mockResolvedValue(null) }));

import { comparePrices, sourcesForCategory } from "./index";
import { searchCroma } from "./croma";

const mockedCroma = vi.mocked(searchCroma);

afterEach(() => vi.clearAllMocks());

describe("sourcesForCategory", () => {
  it("routes electronics to Croma + Reliance", () => {
    expect(sourcesForCategory("electronics")).toEqual(["croma", "reliance"]);
    expect(sourcesForCategory("computers")).toEqual(["croma", "reliance"]);
  });

  it("routes fashion to Myntra + Ajio", () => {
    expect(sourcesForCategory("apparel")).toEqual(["myntra", "ajio"]);
  });

  it("routes beauty/home to Myntra + Meesho", () => {
    expect(sourcesForCategory("beauty")).toEqual(["myntra", "meesho"]);
  });

  it("falls back to every source for unknown, 'all', or 'aps' aliases", () => {
    const all = ["croma", "reliance", "myntra", "ajio", "meesho"];
    expect(sourcesForCategory()).toEqual(all);
    expect(sourcesForCategory("all")).toEqual(all);
    expect(sourcesForCategory("aps")).toEqual(all);
    expect(sourcesForCategory("something-unmapped")).toEqual(all);
  });
});

describe("comparePrices", () => {
  it("searches sources with the trimmed core query, not the full marketing title", async () => {
    await comparePrices(
      "iQOO Neo 10 (Alpine White, 8GB RAM, 256GB) | Segment's Fastest Processor* | 120W FlashCharge",
      "electronics"
    );
    expect(mockedCroma).toHaveBeenCalledWith("iQOO Neo 10");
  });
});
