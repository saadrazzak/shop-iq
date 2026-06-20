import { describe, expect, it } from "vitest";
import { formatViewCount, parseViewCount } from "./socialFormat";

describe("parseViewCount", () => {
  it("parses plain counts with thousands separators", () => {
    expect(parseViewCount("46,880 views")).toBe(46880);
  });

  it("expands K and M suffixes", () => {
    expect(parseViewCount("1.2M views")).toBe(1_200_000);
    expect(parseViewCount("12K views")).toBe(12_000);
  });

  it("returns 0 for unparseable text", () => {
    expect(parseViewCount("no views yet")).toBe(0);
  });
});

describe("formatViewCount", () => {
  it("compacts thousands and millions, dropping trailing .0", () => {
    expect(formatViewCount("12000 views")).toBe("12k views");
    expect(formatViewCount("1500000 views")).toBe("1.5m views");
    expect(formatViewCount("950 views")).toBe("950 views");
  });
});
