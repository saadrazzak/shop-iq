import { describe, expect, it } from "vitest";
import {
  computePriceHistoryStats,
  getPriceAlert,
  parsePriceHistoryText,
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
});

describe("getPriceAlert", () => {
  function stats(overrides: Partial<PriceHistoryStats>): PriceHistoryStats {
    return {
      lowest: { label: "lo", price: 80 },
      highest: { label: "hi", price: 120 },
      current: { label: "cur", price: 100 },
      average: 100,
      weeklyChangePercent: null,
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
});
