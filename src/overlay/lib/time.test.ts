import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./time";

/** ISO string for `seconds` ago, relative to now. */
function ago(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

describe("formatRelativeTime", () => {
  it("returns 'now' for anything under a minute", () => {
    expect(formatRelativeTime(ago(10))).toBe("now");
    expect(formatRelativeTime(ago(59))).toBe("now");
  });

  it("uses the largest fitting unit with a compact abbreviation", () => {
    expect(formatRelativeTime(ago(5 * 60))).toBe("5m");
    expect(formatRelativeTime(ago(3 * 60 * 60))).toBe("3h");
    expect(formatRelativeTime(ago(5 * 24 * 60 * 60))).toBe("5d");
    expect(formatRelativeTime(ago(2 * 7 * 24 * 60 * 60))).toBe("2w");
    expect(formatRelativeTime(ago(400 * 24 * 60 * 60))).toBe("1y");
  });
});
