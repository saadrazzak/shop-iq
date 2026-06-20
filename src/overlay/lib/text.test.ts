import { describe, expect, it } from "vitest";
import { stripEmojis } from "./text";

describe("stripEmojis", () => {
  it("removes emoji and collapses the whitespace left behind", () => {
    expect(stripEmojis("Great 👍 phone")).toBe("Great phone");
    expect(stripEmojis("Love it 🚀🔥 so much")).toBe("Love it so much");
  });

  it("leaves plain text untouched", () => {
    expect(stripEmojis("Solid build quality")).toBe("Solid build quality");
  });

  it("trims when the string is only emoji", () => {
    expect(stripEmojis("🚀")).toBe("");
  });
});
