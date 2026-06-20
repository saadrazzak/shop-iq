import { describe, expect, it } from "vitest";
import {
  calculateTitleSimilarity,
  compareAttributes,
  extractProductAttributes,
  matchProduct,
  parsePrice,
  variantDiffers
} from "./product-matcher";

describe("parsePrice", () => {
  it("strips currency symbols and separators", () => {
    expect(parsePrice("₹54,999")).toBe(54999);
    expect(parsePrice("1,299.50")).toBe(1299.5);
  });

  it("returns undefined for missing or non-numeric input", () => {
    expect(parsePrice()).toBeUndefined();
    expect(parsePrice("call for price")).toBeUndefined();
  });
});

describe("extractProductAttributes", () => {
  it("pulls brand, RAM, storage and colour out of a title", () => {
    expect(extractProductAttributes("Apple MacBook Air M4 16GB RAM 512GB SSD Midnight")).toEqual({
      brand: "Apple",
      ram: "16GB",
      storage: "512GB",
      color: "Midnight"
    });
  });

  it("treats the largest non-RAM capacity as storage", () => {
    const attrs = extractProductAttributes("Phone 8GB RAM, 256GB Black");
    expect(attrs.ram).toBe("8GB");
    expect(attrs.storage).toBe("256GB");
  });

  it("returns an empty object for a thin title", () => {
    expect(extractProductAttributes("Generic gadget")).toEqual({});
  });
});

describe("calculateTitleSimilarity", () => {
  it("scores a model-matching candidate near 1 even amid marketing copy", () => {
    const score = calculateTitleSimilarity(
      "Sony WH-1000XM5",
      "Sony WH-1000XM5 Wireless Noise Cancelling Headphones Black"
    );
    expect(score).toBeGreaterThan(0.9);
  });

  it("penalizes a same-brand different-model candidate", () => {
    const score = calculateTitleSimilarity("Sony WH-1000XM5", "Sony WH-CH720N Wireless Headphones");
    expect(score).toBeLessThan(0.5);
  });

  it("returns 0 for an empty original", () => {
    expect(calculateTitleSimilarity("", "anything")).toBe(0);
  });
});

describe("compareAttributes", () => {
  it("returns the matching fraction of the original's attributes", () => {
    expect(
      compareAttributes({ brand: "Apple", storage: "512GB" }, { brand: "Apple", storage: "256GB" })
    ).toBe(0.5);
  });

  it("returns a neutral 0.5 when the original has no attributes", () => {
    expect(compareAttributes({}, { brand: "Apple" })).toBe(0.5);
  });
});

describe("matchProduct", () => {
  it("scores an identical product near 1", () => {
    const title = "Apple iPhone 15 128GB Black";
    const attrs = extractProductAttributes(title);
    expect(matchProduct(title, title, attrs, attrs)).toBeGreaterThan(0.9);
  });
});

describe("variantDiffers", () => {
  it("flags a different storage or colour as a variant", () => {
    expect(variantDiffers("iPhone 15 128GB Black", "iPhone 15 256GB Black")).toBe(true);
    expect(variantDiffers("iPhone 15 128GB Black", "iPhone 15 128GB Blue")).toBe(true);
  });

  it("does not flag an identical or attribute-missing candidate", () => {
    expect(variantDiffers("iPhone 15 128GB Black", "iPhone 15 128GB Black")).toBe(false);
    expect(variantDiffers("iPhone 15 128GB Black", "iPhone 15")).toBe(false);
  });
});
