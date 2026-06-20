import { describe, expect, it } from "vitest";
import { formatCurrency, formatRupees, parseNumericValue } from "./format";

describe("parseNumericValue", () => {
  it("returns undefined for missing/empty input", () => {
    expect(parseNumericValue()).toBeUndefined();
    expect(parseNumericValue("")).toBeUndefined();
  });

  it("strips currency symbols and thousands separators", () => {
    expect(parseNumericValue("₹47,350")).toBe(47350);
    expect(parseNumericValue("1,299")).toBe(1299);
  });

  it("preserves decimals", () => {
    expect(parseNumericValue("4.3")).toBe(4.3);
  });

  it("returns undefined when no digits are present", () => {
    expect(parseNumericValue("not a price")).toBeUndefined();
  });
});

describe("formatCurrency", () => {
  it("renders an em dash for non-numbers", () => {
    expect(formatCurrency(undefined)).toBe("—");
  });

  it("formats a number as INR with no fraction digits", () => {
    // ₹ then grouped digits; exact spacing varies by ICU, so assert the parts.
    const formatted = formatCurrency(47350);
    expect(formatted).toContain("47,350");
    expect(formatted).toMatch(/₹/);
    expect(formatted).not.toMatch(/\.\d/);
  });
});

describe("formatRupees", () => {
  it("prefixes the rupee sign and groups with the Indian locale", () => {
    expect(formatRupees(100000)).toBe("₹1,00,000");
  });
});
