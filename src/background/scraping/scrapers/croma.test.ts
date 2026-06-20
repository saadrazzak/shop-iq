import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../http", () => ({ fetchJson: vi.fn(), fetchText: vi.fn() }));

import { fetchJson } from "../http";
import { searchCroma } from "./croma";

const mockedFetchJson = vi.mocked(fetchJson);

afterEach(() => vi.clearAllMocks());

describe("searchCroma", () => {
  it("maps the best-matching listing from the API response", async () => {
    mockedFetchJson.mockResolvedValueOnce({
      products: [
        {
          name: "Sony WH-1000XM5 Wireless Headphones Black",
          url: "/p/123",
          plpImage: "https://img/x.jpg",
          price: { value: 26990 },
          mrp: { value: 34990 }
        },
        { name: "Some unrelated speaker", url: "/p/999", price: { value: 1999 } }
      ]
    });

    const result = await searchCroma("Sony WH-1000XM5");
    expect(result?.source).toBe("Croma");
    expect(result?.title).toContain("WH-1000XM5");
    expect(result?.price).toBe(26990);
    expect(result?.originalPrice).toBe(34990);
    expect(result?.productUrl).toBe("https://www.croma.com/p/123");
    expect(result?.confidenceScore).toBeGreaterThan(0);
  });

  it("returns null when the request fails", async () => {
    mockedFetchJson.mockRejectedValueOnce(new Error("403"));
    expect(await searchCroma("anything")).toBeNull();
  });
});
