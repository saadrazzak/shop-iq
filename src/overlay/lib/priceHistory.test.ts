import { describe, expect, it } from "vitest";
import {
  computePriceHistoryStats,
  filterImplausiblePoints,
  getPriceAlert,
  getRangeCoverage,
  getYearlyCoverage,
  parseCaretSeparatedRangeText,
  parsePriceHistoryRangeText,
  parsePriceHistoryText,
  parsePricePatternText,
  sliceForRange,
  type PriceHistoryStats,
  type PricePoint
} from "./priceHistory";

describe("parsePriceHistoryText", () => {
  it("extracts 'DD Month - price' pairs and title-cases the month", () => {
    const points = parsePriceHistoryText("14 may - 128, 15 May - ₹1,299, 16 MAY - 321");
    expect(points).toEqual([
      { label: "14 May", price: 128 },
      { label: "15 May", price: 1299 },
      { label: "16 May", price: 321 }
    ]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(parsePriceHistoryText("no prices here")).toEqual([]);
  });
});

describe("parsePriceHistoryRangeText", () => {
  it("expands a date range into one point per day, rolling over the month boundary", () => {
    const text = "Date - 28April-3May, Price - ₹100, ₹200, ₹300, ₹400, ₹500, ₹600";
    expect(parsePriceHistoryRangeText(text)).toEqual([
      { label: "28 April", price: 100 },
      { label: "29 April", price: 200 },
      { label: "30 April", price: 300 },
      { label: "1 May", price: 400 },
      { label: "2 May", price: 500 },
      { label: "3 May", price: 600 }
    ]);
  });

  it("parses the real Amazon response shape, including repeated unchanged prices", () => {
    const text =
      "Date - 25April-23June, Price - ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, " +
      "₹5699, ₹5699, ₹5699, ₹4773, ₹4773, ₹4773, ₹4773, ₹4773, ₹4773, ₹4773, ₹4773, ₹4773, ₹4773, ₹4773, " +
      "₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, " +
      "₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, " +
      "₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699, ₹5699";
    const expectedPrices = Array.from(text.matchAll(/₹([\d,]+)/g)).map((match) =>
      Number(match[1].replace(/,/g, ""))
    );

    const points = parsePriceHistoryRangeText(text);

    expect(points).toHaveLength(expectedPrices.length);
    expect(points.map((point) => point.price)).toEqual(expectedPrices);
    expect(points[0]).toEqual({ label: "25 April", price: 5699 });
    expect(points[1].label).toBe("26 April");
  });

  it("returns an empty array for the old per-day format, so callers fall back to parsePriceHistoryText", () => {
    expect(parsePriceHistoryRangeText("14 may - 128, 15 may - 130")).toEqual([]);
  });

  it("uses the explicit year on the start date when the range crosses a calendar year, and skips a 'null' gap without misaligning later dates", () => {
    const text = "date - 30Dec2025-1Jan2026 | price - ₹100,null,₹300";
    expect(parsePriceHistoryRangeText(text)).toEqual([
      { label: "30 December", price: 100 },
      // 31 Dec (index 1, "null") is dropped, but 1 Jan (index 2) still lands
      // on the correct date rather than shifting back to where 31 Dec was.
      { label: "1 January", price: 300 }
    ]);
  });

  it("parses the real 6-month Amazon response shape, with a pipe separator and a 'null' day", () => {
    const text =
      "date - 26Dec2025-23Jun2026 | price - ₹5998,₹5998,₹5998,₹5998,₹5998,₹5998,₹5999,₹5999,₹5999,₹5999," +
      "₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5598,₹5598,₹5598,₹5598,₹5598,₹5598," +
      "₹5598,₹5598,₹5598,₹5598,₹5598,₹5598,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999," +
      "₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999," +
      "₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999," +
      "₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999," +
      "₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5999,₹5720,₹5720,₹5720,₹5720," +
      "₹5998,₹5959,₹5959,₹5898,₹5898,₹5898,₹5599,₹5599,₹5599,₹5599,₹5599,₹5599,₹5599,₹5599,₹5599,₹5599," +
      "₹5599,₹5918,₹5918,₹5918,₹5918,₹5918,₹5918,₹5918,₹5918,₹5918,₹5918,₹5918,₹5918,₹5918,₹5918,₹5999," +
      "₹5999,₹5999,₹5999,₹5918,₹5918,₹5918,₹5918,₹5918,₹5918,₹5918,₹5918,₹5918,₹5918,₹5918,₹5918,₹5918," +
      "₹5918,₹5918,₹5918,₹5918,null,₹5918";
    const tokenCount = text.split("price -")[1].split(",").length;

    const points = parsePriceHistoryRangeText(text);

    // One token is "null" - everything else should parse to a finite price.
    expect(points).toHaveLength(tokenCount - 1);
    expect(points.every((point) => Number.isFinite(point.price))).toBe(true);
    expect(points[0]).toEqual({ label: "26 December", price: 5998 });

    // The last token's date, computed independently from the start date and
    // token count - if the 'null' gap had shifted the date math, this would
    // disagree with what the parser actually produced.
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const expectedLastDate = new Date(2025, 11, 26);
    expectedLastDate.setDate(expectedLastDate.getDate() + (tokenCount - 1));
    const expectedLastLabel = `${expectedLastDate.getDate()} ${months[expectedLastDate.getMonth()]}`;
    expect(points[points.length - 1].label).toBe(expectedLastLabel);
  });

  it("handles the 'Date: ... to ...' colon/word-separator variant with comma-grouped prices", () => {
    // "1,100,null,999,2,200" must split into [1100, gap, 999, 2200] - not
    // ["1","100","null","999","2","200"] (a naive comma-split) and not
    // ["1","100,null,999,2","200"] either.
    const text = "Date: 30 December 2025 to 3 January 2026 | Price: ₹1,100,null,999,2,200";
    expect(parsePriceHistoryRangeText(text)).toEqual([
      { label: "30 December", price: 1100 },
      // 31 Dec (index 1, "null") is dropped; 1 Jan (index 2) still lands on
      // the right date instead of shifting back to where 31 Dec was.
      { label: "1 January", price: 999 },
      { label: "2 January", price: 2200 }
    ]);
  });

  it("parses the real comma-grouped 6-month response (colon separators, no '₹' per entry)", () => {
    const text =
      "Date: 26 December 2025 to 23 June 2026 | Price: ₹5,499,5,499,5,499,5,499,5,499,5,499,5,499,5,499," +
      "5,499,5,499,5,499,5,499,5,499,5,499,3,999,3,999,3,999,3,999,3,999,3,999,3,999,3,999,3,999,3,999," +
      "3,999,3,999,3,999,3,999,3,999,3,999,3,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999," +
      "4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999," +
      "4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999," +
      "4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999," +
      "4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999," +
      "4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999," +
      "4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,4,999,3,999,3,999,3,999,3,999,3,999," +
      "3,999,3,999,3,999,3,999,3,999,3,999,5,999,5,999,5,999,5,999,5,999,5,999,5,999,5,999,5,999,5,999," +
      "5,999,5,999,5,999,5,999,5,999,5,999,5,999,5,999,5,999,5,999,5,999,5,999,5,999,5,999,5,999,5,999," +
      "5,999,5,999,5,999,5,999,5,999,5,999";
    // Same grouped-number extraction the parser uses, computed independently
    // here so this test isn't just asserting "whatever the parser does".
    const expectedPrices = Array.from(
      text.split("Price:")[1].matchAll(/\d{1,3}(?:,\d{3})*/g)
    ).map((match) => Number(match[0].replace(/,/g, "")));

    const points = parsePriceHistoryRangeText(text);

    expect(points).toHaveLength(expectedPrices.length);
    expect(points.map((point) => point.price)).toEqual(expectedPrices);
    expect(points.every((point) => Number.isFinite(point.price))).toBe(true);
    expect(points[0]).toEqual({ label: "26 December", price: 5499 });
    expect(points[1].label).toBe("27 December");
  });
});

describe("parseCaretSeparatedRangeText", () => {
  it("parses the current prompt's example format", () => {
    const text = "date-12Mar to 14Aug|price-111^110^115^120";
    expect(parseCaretSeparatedRangeText(text)).toEqual([
      { label: "12 March", price: 111 },
      { label: "13 March", price: 110 },
      { label: "14 March", price: 115 },
      { label: "15 March", price: 120 }
    ]);
  });

  it("safely strips internal thousands-grouping commas, since '^' (not comma) is the only entry separator", () => {
    const text = "date-1Jan to 4Jan|price-1,100^999^null^2,200";
    expect(parseCaretSeparatedRangeText(text)).toEqual([
      { label: "1 January", price: 1100 },
      { label: "2 January", price: 999 },
      // 3 Jan ("null") is dropped; 4 Jan still lands on the right date.
      { label: "4 January", price: 2200 }
    ]);
  });

  it("steps by 7 days per entry for the weekly 1-year fetch", () => {
    const text = "date-1Jan to 10Mar|price-111^110^115^120";
    expect(parseCaretSeparatedRangeText(text, 7)).toEqual([
      { label: "1 January", price: 111 },
      { label: "8 January", price: 110 },
      { label: "15 January", price: 115 },
      { label: "22 January", price: 120 }
    ]);
  });

  it("returns an empty array when there's no '^' at all, so callers fall back to the comma-based parser instead of mangling the whole list into one number", () => {
    expect(parseCaretSeparatedRangeText("date - 25April-23June, price - 111,110,115")).toEqual([]);
  });
});

describe("parsePricePatternText", () => {
  it("expands a date-range line into one point per day, and a single-day line into one point", () => {
    const text = "1 Jan-3 Jan: ₹100\n4 Jan: ₹200";
    expect(parsePricePatternText(text)).toEqual([
      { label: "1 January", price: 100 },
      { label: "2 January", price: 100 },
      { label: "3 January", price: 100 },
      { label: "4 January", price: 200 }
    ]);
  });

  it("ignores trailing parentheticals like '(current price)' when reading the price", () => {
    const text = "1 Feb: ₹1,099 (highest price - single day spike)";
    expect(parsePricePatternText(text)).toEqual([{ label: "1 February", price: 1099 }]);
  });

  it("parses a pure one-line-per-day response with no ranges at all - the current prompt's ideal output", () => {
    const text = '"12 Mar: ₹999"\n"13 Mar: ₹999"\n"14 Mar: ₹1,050"';
    expect(parsePricePatternText(text)).toEqual([
      { label: "12 March", price: 999 },
      { label: "13 March", price: 999 },
      { label: "14 March", price: 1050 }
    ]);
  });

  it("doesn't mistake a lead-in phrase like 'the last 3 months:' for a date, which would otherwise swallow the real next entry's day digits", () => {
    const text =
      "Here is the daily price for the last 3 months: 27 Mar: ₹618, 28 Mar: ₹618, 29 Mar: ₹618.";
    expect(parsePricePatternText(text)).toEqual([
      { label: "27 March", price: 618 },
      { label: "28 March", price: 618 },
      { label: "29 March", price: 618 }
    ]);
  });

  it("parses the real one-paragraph, comma-separated response Rufus returns for a 3-month daily request", () => {
    const text =
      "Here is the daily price for the Arctic Fox Pureview Transparent Wireless Mouse for the last 3 months: " +
      "27 Mar: ₹618, 28 Mar: ₹618, 29 Mar: ₹618, 30 Mar: ₹618, 31 Mar: ₹618, 1 Apr: ₹618, 2 Apr: ₹618, " +
      "3 Apr: ₹618, 4 Apr: ₹618, 5 Apr: ₹618, 6 Apr: ₹618, 7 Apr: ₹618, 8 Apr: ₹618, 9 Apr: ₹618, " +
      "10 Apr: ₹618, 11 Apr: ₹618, 12 Apr: ₹618, 13 Apr: ₹618, 14 Apr: ₹618, 15 Apr: ₹618, 16 Apr: ₹618, " +
      "17 Apr: ₹618, 18 Apr: ₹618, 19 Apr: ₹618, 20 Apr: ₹618, 21 Apr: ₹618, 22 Apr: ₹618, 23 Apr: ₹618, " +
      "24 Apr: ₹618, 25 Apr: ₹618, 26 Apr: ₹618, 27 Apr: ₹618, 28 Apr: ₹618, 29 Apr: ₹618, 30 Apr: ₹618, " +
      "1 May: ₹618, 2 May: ₹618, 3 May: ₹618, 4 May: ₹618, 5 May: ₹618, 6 May: ₹618, 7 May: ₹599, " +
      "8 May: ₹599, 9 May: ₹599, 10 May: ₹599, 11 May: ₹599, 12 May: ₹599, 13 May: ₹599, 14 May: ₹599, " +
      "15 May: ₹599, 16 May: ₹599, 17 May: ₹599, 18 May: ₹599, 19 May: ₹618, 20 May: ₹618, 21 May: ₹618, " +
      "22 May: ₹618, 23 May: ₹618, 24 May: ₹618, 25 May: ₹618, 26 May: ₹618, 27 May: ₹618, 28 May: ₹618, " +
      "29 May: ₹618, 30 May: ₹618, 31 May: ₹618, 1 Jun: ₹649, 2 Jun: ₹649, 3 Jun: ₹649, 4 Jun: ₹649, " +
      "5 Jun: ₹649, 6 Jun: ₹649, 7 Jun: ₹649, 8 Jun: ₹649, 9 Jun: ₹649, 10 Jun: ₹649, 11 Jun: ₹649, " +
      "12 Jun: ₹649, 13 Jun: ₹649, 14 Jun: ₹649, 15 Jun: ₹649, 16 Jun: ₹649, 17 Jun: ₹649, 18 Jun: ₹649, " +
      "19 Jun: ₹649, 20 Jun: ₹649, 21 Jun: ₹649, 22 Jun: ₹649, 23 Jun: ₹649.";

    const points = parsePricePatternText(text);

    expect(points).toHaveLength(89);
    expect(points[0]).toEqual({ label: "27 March", price: 618 });
    expect(points[points.length - 1]).toEqual({ label: "23 June", price: 649 });
    // The two price changes (618 -> 599 on 7 May, back to 618 on 19 May, then
    // 649 on 1 Jun) all land on the correct day.
    expect(points.find((point) => point.label === "7 May")).toEqual({ label: "7 May", price: 599 });
    expect(points.find((point) => point.label === "19 May")).toEqual({ label: "19 May", price: 618 });
    expect(points.find((point) => point.label === "1 June")).toEqual({ label: "1 June", price: 649 });
  });

  it("parses the real 'Price Pattern' summary Rufus sometimes returns instead of a daily list", () => {
    const text = `Over the past 6 months, the Spigen Liquid Air case for iPhone 17 has ranged from ₹883 to ₹1,099. Here's the daily price data from December 2025 to June 2026:

Date Range: 26 December 2025 to 23 June 2026

Price Pattern:

26 Dec-14 Jan: ₹930
15 Jan-26 Jan: ₹883 (lowest price)
27 Jan-31 Jan: ₹930
1 Feb: ₹1,099 (highest price - single day spike)
2 Feb-27 Feb: ₹930
28 Feb-6 May: ₹999
7 May-17 May: ₹949
18 May-23 Jun: ₹999 (current price)

The case is currently priced at ₹999, which is ₹116 above the lowest recorded price of ₹883 during the January period.`;

    const points = parsePricePatternText(text);

    // 26 Dec 2025 through 23 Jun 2026 inclusive, with no gaps between lines.
    expect(points).toHaveLength(180);
    expect(points[0]).toEqual({ label: "26 December", price: 930 });
    expect(points[points.length - 1]).toEqual({ label: "23 June", price: 999 });
    // The single-day spike and the lowest-price run both land correctly.
    expect(points.find((point) => point.label === "1 February")).toEqual({ label: "1 February", price: 1099 });
    expect(points.find((point) => point.label === "15 January")).toEqual({ label: "15 January", price: 883 });
  });

  it("returns an empty array for text with no 'DD Month: price' lines", () => {
    expect(parsePricePatternText("no price pattern here")).toEqual([]);
  });

  it("parses the real response with 5-digit comma-grouped prices (e.g. ₹43,500), not just 4-digit ones", () => {
    const text =
      "Here's the daily price data for the Lenovo IdeaPad 1 AMD Ryzen 5 5500U over the last 3 months: " +
      "27 Mar: ₹43,500, 28 Mar: ₹43,500, 29 Mar: ₹43,990, 30 Mar: ₹43,990, 31 Mar: ₹43,990, 1 Apr: ₹43,990, " +
      "2 Apr: ₹43,990, 3 Apr: ₹43,999, 4 Apr: ₹43,990, 5 Apr: ₹43,990, 6 Apr: ₹43,990, 7 Apr: ₹43,990, " +
      "8 Apr: ₹43,990, 9 Apr: ₹44,580, 10 Apr: ₹44,580, 11 Apr: ₹44,590, 12 Apr: ₹45,901, 13 Apr: ₹45,901, " +
      "14 Apr: ₹45,901, 15 Apr: ₹45,901, 16 Apr: ₹45,901, 17 Apr: ₹45,411, 18 Apr: ₹45,011, 19 Apr: ₹44,811, " +
      "20 Apr: ₹44,011, 21 Apr: ₹43,811, 22 Apr: ₹43,811, 23 Apr: ₹43,811, 24 Apr: ₹43,811, 25 Apr: ₹43,811, " +
      "26 Apr: ₹43,811, 27 Apr: ₹44,911, 28 Apr: ₹44,911, 29 Apr: ₹44,899, 30 Apr: ₹45,849, 1 May: ₹47,699, " +
      "2 May: ₹47,500, 3 May: ₹47,899, 4 May: ₹47,899, 5 May: ₹47,809, 6 May: ₹47,809, 7 May: ₹44,911, " +
      "8 May: ₹44,349, 9 May: ₹43,900, 10 May: ₹43,895, 11 May: ₹43,800, 12 May: ₹43,800, 13 May: ₹43,800, " +
      "14 May: ₹44,400, 15 May: ₹44,400, 16 May: ₹44,400, 17 May: ₹44,800, 18 May: ₹44,600, 19 May: ₹44,200, " +
      "20 May: ₹44,200, 21 May: ₹44,411, 22 May: ₹44,311, 23 May: ₹44,311, 24 May: ₹44,311, 25 May: ₹45,300, " +
      "26 May: ₹47,611, 27 May: ₹47,461, 28 May: ₹47,261, 29 May: ₹46,999, 30 May: ₹47,861, 31 May: ₹47,950, " +
      "1 Jun: ₹47,950, 2 Jun: ₹48,300, 3 Jun: ₹49,700, 4 Jun: ₹49,950, 5 Jun: ₹49,700, 6 Jun: ₹49,850, " +
      "7 Jun: ₹49,850, 8 Jun: ₹49,800, 9 Jun: ₹49,750, 10 Jun: ₹49,750, 11 Jun: ₹49,750, 12 Jun: ₹49,750, " +
      "13 Jun: ₹49,800, 14 Jun: ₹49,975, 15 Jun: ₹44,990, 16 Jun: ₹49,975, 17 Jun: ₹49,990, 18 Jun: ₹49,990, " +
      "19 Jun: ₹49,990, 20 Jun: ₹49,750, 21 Jun: ₹49,999, 22 Jun: ₹36,490, 24 Jun: ₹50,990. The lowest price " +
      "during this period was ₹36,490 on 22 June and the current price is ₹50,990.";

    const points = parsePricePatternText(text);

    expect(points).toHaveLength(89);
    expect(points[0]).toEqual({ label: "27 March", price: 43500 });
    // 23 Jun is genuinely missing from Rufus's own response (jumps straight
    // to 24 Jun) - the parser must not invent or misplace a value for it.
    expect(points.find((point) => point.label === "23 June")).toBeUndefined();
    expect(points[points.length - 1]).toEqual({ label: "24 June", price: 50990 });
    expect(points.find((point) => point.label === "22 June")).toEqual({ label: "22 June", price: 36490 });
  });

  it("parses the real weekly 1-year response, where every single entry carries its own year", () => {
    const text =
      "Here's the weekly price history for the HP 15 Laptop over the past year: " +
      "24 Jun 2025: ₹69,790, 1 Jul 2025: ₹69,790, 8 Jul 2025: ₹69,790, 15 Jul 2025: ₹69,790, " +
      "22 Jul 2025: ₹69,790, 29 Jul 2025: ₹69,790, 5 Aug 2025: ₹69,790, 12 Aug 2025: ₹69,790, " +
      "19 Aug 2025: ₹69,790, 26 Aug 2025: ₹69,790, 2 Sep 2025: ₹69,790, 9 Sep 2025: ₹69,790, " +
      "16 Sep 2025: ₹69,790, 23 Sep 2025: ₹69,790, 30 Sep 2025: ₹69,790, 7 Oct 2025: ₹69,790, " +
      "14 Oct 2025: ₹69,790, 21 Oct 2025: ₹69,790, 28 Oct 2025: ₹69,790, 4 Nov 2025: ₹69,790, " +
      "11 Nov 2025: ₹69,790, 18 Nov 2025: ₹69,790, 25 Nov 2025: ₹69,790, 2 Dec 2025: ₹69,790, " +
      "9 Dec 2025: ₹69,790, 16 Dec 2025: ₹69,790, 23 Dec 2025: ₹69,790, 30 Dec 2025: ₹69,790, " +
      "6 Jan 2026: ₹69,790, 13 Jan 2026: ₹69,790, 20 Jan 2026: ₹69,790, 27 Jan 2026: ₹69,790, " +
      "3 Feb 2026: ₹69,790, 10 Feb 2026: ₹69,790, 17 Feb 2026: ₹69,790, 24 Feb 2026: ₹69,790, " +
      "3 Mar 2026: ₹69,790, 10 Mar 2026: ₹69,790, 17 Mar 2026: ₹69,790, 24 Mar 2026: ₹69,790, " +
      "31 Mar 2026: ₹69,790, 7 Apr 2026: ₹69,990, 14 Apr 2026: ₹67,990, 21 Apr 2026: ₹67,990, " +
      "28 Apr 2026: ₹67,990, 5 May 2026: ₹67,990, 12 May 2026: ₹63,550, 19 May 2026: ₹67,300, " +
      "26 May 2026: ₹67,290, 2 Jun 2026: ₹68,790, 9 Jun 2026: ₹69,790, 16 Jun 2026: ₹69,790, " +
      "23 Jun 2026: ₹68,180. The laptop remained stable at ₹69,790 for most of the year.";

    const points = parsePricePatternText(text);

    // 24 Jun 2025 through 23 Jun 2026, one entry per week (53 weeks).
    expect(points).toHaveLength(53);
    expect(points[0]).toEqual({ label: "24 June", price: 69790 });
    expect(points[points.length - 1]).toEqual({ label: "23 June", price: 68180 });
    // The dip to ₹63,550 on 12 May 2026 must land on its own correct week,
    // not get dropped or merged with a neighboring entry.
    expect(points.find((point) => point.label === "12 May")).toEqual({ label: "12 May", price: 63550 });
  });
});

describe("sliceForRange", () => {
  const points: PricePoint[] = Array.from({ length: 150 }, (_, i) => ({ label: `d${i}`, price: i }));

  it("'1m' keeps only the most recent 30 points", () => {
    const sliced = sliceForRange(points, "1m");
    expect(sliced).toHaveLength(30);
    expect(sliced[0].label).toBe("d120");
    expect(sliced[29].label).toBe("d149");
  });

  it("'3m' keeps everything fetched", () => {
    expect(sliceForRange(points, "3m")).toHaveLength(150);
  });

  it("degrades gracefully when fewer days were fetched than the window asks for", () => {
    const short = points.slice(0, 10);
    expect(sliceForRange(short, "1m")).toHaveLength(10);
  });
});

describe("getRangeCoverage", () => {
  it("is not limited when the full history at least covers the selected window", () => {
    expect(getRangeCoverage(30, "1m").isLimited).toBe(false);
    expect(getRangeCoverage(90, "3m").isLimited).toBe(false);
  });

  it("tolerates minor shortfalls (e.g. a dropped 'null' day) without flagging", () => {
    // 80/90 = ~89%, comfortably above the 80% shortfall threshold.
    expect(getRangeCoverage(80, "3m").isLimited).toBe(false);
  });

  it("flags a new product that hasn't been tracked for the full selected window", () => {
    const coverage = getRangeCoverage(10, "3m");
    expect(coverage.isLimited).toBe(true);
    expect(coverage.availableCount).toBe(10);
    expect(coverage.unit).toBe("day");
    expect(coverage.targetLabel).toBe("3 months");
  });

  it("flags a shortfall on the 1-month tab too, not just 3m", () => {
    expect(getRangeCoverage(5, "1m").isLimited).toBe(true);
  });
});

describe("getYearlyCoverage", () => {
  it("is not limited when at least 52 weekly entries came back", () => {
    expect(getYearlyCoverage(52).isLimited).toBe(false);
  });

  it("flags a new product that hasn't accrued a year of weekly history", () => {
    const coverage = getYearlyCoverage(8);
    expect(coverage.isLimited).toBe(true);
    expect(coverage.availableCount).toBe(8);
    expect(coverage.unit).toBe("week");
    expect(coverage.targetLabel).toBe("1 year");
  });
});

describe("filterImplausiblePoints", () => {
  const points: PricePoint[] = [
    { label: "1 Jan", price: 100 },
    { label: "2 Jan", price: 43500 },
    // Looks like a comma-parsing artifact (e.g. "43,500" misread down to
    // just "43") if the product's real price is around ₹43,500.
    { label: "3 Jan", price: 43 }
  ];

  it("passes everything through when no reference price is known", () => {
    expect(filterImplausiblePoints(points)).toEqual(points);
    expect(filterImplausiblePoints(points, 0)).toEqual(points);
  });

  it("drops a point that's wildly inconsistent with the reference price", () => {
    expect(filterImplausiblePoints(points, 43500)).toEqual([{ label: "2 Jan", price: 43500 }]);
  });

  it("keeps large comma-grouped prices that are genuinely close to the reference - the real Lenovo IdeaPad response", () => {
    const realPoints: PricePoint[] = [
      { label: "27 March", price: 43500 },
      { label: "22 June", price: 36490 },
      { label: "24 June", price: 50990 }
    ];
    expect(filterImplausiblePoints(realPoints, 50990)).toEqual(realPoints);
  });

  it("keeps values exactly at the 0.2x/5x boundary, drops just outside it", () => {
    const boundary: PricePoint[] = [
      { label: "low edge", price: 200 },
      { label: "high edge", price: 5000 },
      { label: "too low", price: 199 },
      { label: "too high", price: 5001 }
    ];
    expect(filterImplausiblePoints(boundary, 1000)).toEqual([
      { label: "low edge", price: 200 },
      { label: "high edge", price: 5000 }
    ]);
  });
});

describe("computePriceHistoryStats", () => {
  it("finds lowest/highest/current/average and leaves weekly change null for short series", () => {
    const points: PricePoint[] = [
      { label: "1 Jun", price: 100 },
      { label: "2 Jun", price: 80 },
      { label: "3 Jun", price: 120 }
    ];
    const stats = computePriceHistoryStats(points);
    expect(stats.lowest).toEqual({ label: "2 Jun", price: 80 });
    expect(stats.highest).toEqual({ label: "3 Jun", price: 120 });
    expect(stats.current).toEqual({ label: "3 Jun", price: 120 });
    expect(stats.average).toBe(100);
    expect(stats.weeklyChangePercent).toBeNull();
  });

  it("computes week-over-week change when two full weeks are present", () => {
    // 14 points: first 7 at 100, last 7 at 110 → +10% this week.
    const points: PricePoint[] = Array.from({ length: 14 }, (_, i) => ({
      label: `d${i}`,
      price: i < 7 ? 100 : 110
    }));
    expect(computePriceHistoryStats(points).weeklyChangePercent).toBe(10);
  });

  it("sets windowDays to the number of points, for the dynamic 'in N days' wording", () => {
    const points: PricePoint[] = [
      { label: "1 Jun", price: 100 },
      { label: "2 Jun", price: 110 }
    ];
    expect(computePriceHistoryStats(points).windowDays).toBe(2);
  });
});

describe("getPriceAlert", () => {
  function stats(overrides: Partial<PriceHistoryStats>): PriceHistoryStats {
    return {
      lowest: { label: "lo", price: 80 },
      highest: { label: "hi", price: 120 },
      current: { label: "cur", price: 100 },
      average: 100,
      weeklyChangePercent: null,
      windowDays: 30,
      ...overrides
    };
  }

  it("reports a flat price when there is no 30-day variation", () => {
    const alert = getPriceAlert(
      stats({ lowest: { label: "x", price: 100 }, highest: { label: "x", price: 100 } })
    );
    expect(alert.tone).toBe("same");
    expect(alert.message).toMatch(/hasn't changed/);
  });

  it("flags the lowest price in 30 days", () => {
    const alert = getPriceAlert(stats({ current: { label: "cur", price: 80 } }));
    expect(alert.tone).toBe("low");
    expect(alert.message).toMatch(/Lowest in 30 days/);
  });

  it("flags the highest price in 30 days", () => {
    const alert = getPriceAlert(stats({ current: { label: "cur", price: 120 } }));
    expect(alert.tone).toBe("high");
  });

  it("calls out a meaningful discount vs. the average", () => {
    const alert = getPriceAlert(stats({ current: { label: "cur", price: 90 } }));
    expect(alert.tone).toBe("low");
    expect(alert.message).toMatch(/lower/);
  });

  it("attaches a week-over-week detail when the swing is big enough", () => {
    const alert = getPriceAlert(stats({ current: { label: "cur", price: 90 }, weeklyChangePercent: -8 }));
    expect(alert.detail).toBe("Down 8% from last week");
  });

  it("reflects the stats' windowDays in the message, e.g. for a longer-history tab", () => {
    const alert = getPriceAlert(stats({ current: { label: "cur", price: 80 }, windowDays: 60 }));
    expect(alert.message).toMatch(/Lowest in 60 days/);
  });
});
