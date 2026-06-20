import { describe, expect, it } from "vitest";
import { buildSearchQuery, isRelevantResult, relevanceScore, tokenize } from "./query";

describe("buildSearchQuery", () => {
  it("trims a verbose listing title to its core product name", () => {
    expect(buildSearchQuery("Apple 2023 MacBook Pro (16-inch, 16GB, 512GB) - Space Black")).toBe(
      "Apple 2023 MacBook Pro"
    );
  });

  it("caps the query at six words", () => {
    expect(buildSearchQuery("one two three four five six seven eight")).toBe("one two three four five six");
  });

  it("cuts pipe-separated marketing titles at the first pipe", () => {
    expect(
      buildSearchQuery("OnePlus Nord 6 | 8GB+256GB | Pitch Black | Snapdragon 8s Gen 4 | Personalized AI")
    ).toBe("OnePlus Nord 6");
    expect(
      buildSearchQuery("iQOO Neo 10 (Alpine White, 8GB RAM, 256GB) | Segment's Fastest Processor*")
    ).toBe("iQOO Neo 10");
  });

  it("cuts comma-separated spec fragments at the first comma", () => {
    expect(buildSearchQuery("boAt Airdopes Joy, 35Hrs Battery, Fast Charging, IPX4")).toBe(
      "boAt Airdopes Joy"
    );
    expect(buildSearchQuery("Puma Mens Dazzler Sneaker, Red-White, Size 9")).toBe("Puma Mens Dazzler Sneaker");
  });
});

describe("tokenize", () => {
  it("lowercases, strips punctuation, and drops stopwords and bare years", () => {
    // "review", "for", "the" and the bare year "2024" are dropped; "best" is not a search stopword.
    expect(tokenize("Sony WH-1000XM5 review 2024 for the Best")).toEqual(["sony", "wh", "1000xm5", "best"]);
  });
});

describe("isRelevantResult", () => {
  const query = tokenize("Sony WH-1000XM5 headphones"); // ["sony","wh","1000xm5","headphones"]

  it("accepts a result that shares the model token", () => {
    expect(isRelevantResult(query, "My Sony WH-1000XM5 long-term impressions")).toBe(true);
  });

  it("rejects a result matching only generic words", () => {
    expect(isRelevantResult(query, "Best wireless headphones of the year")).toBe(false);
  });

  it("accepts when an empty query is given", () => {
    expect(isRelevantResult([], "anything goes")).toBe(true);
  });
});

describe("relevanceScore", () => {
  const query = tokenize("Sony WH-1000XM5 headphones"); // anchors: ["sony","wh","1000xm5"] ("headphones" is generic)

  it("scores a full title match at 1", () => {
    expect(relevanceScore(query, "Sony WH-1000XM5 long-term review")).toBe(1);
  });

  it("returns 0 when the model token is missing (different product)", () => {
    // brand matches but the model number doesn't — the strongest mismatch signal
    expect(relevanceScore(query, "Sony WH-1000XM4 still worth it in 2026?")).toBe(0);
  });

  it("ignores generic words so a vague title scores low", () => {
    expect(relevanceScore(tokenize("boAt Rockerz 450 Bluetooth"), "Best bluetooth headphones?")).toBe(0);
  });

  it("gives partial credit for a partial brand match (no model token to gate on)", () => {
    // anchors = ["samsung","galaxy","buds"]; title covers two of three → ~0.67
    expect(relevanceScore(tokenize("Samsung Galaxy Buds Pro"), "Samsung Galaxy review")).toBeCloseTo(2 / 3);
  });

  it("returns 0 when the known brand is absent from the title", () => {
    // model number matches but it's a different brand's listing entirely
    expect(relevanceScore(query, "JBL WH-1000XM5 clone unboxing", tokenize("Sony"))).toBe(0);
  });

  it("keeps a result that contains the known brand", () => {
    expect(relevanceScore(query, "Sony WH-1000XM5 long-term review", tokenize("Sony"))).toBe(1);
  });
});
