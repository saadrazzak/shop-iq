import { describe, expect, it } from "vitest";
import { extractBalancedAfter } from "./util";

describe("extractBalancedAfter", () => {
  it("extracts the first balanced object after a marker", () => {
    const html = `<script>window.__myx = {"a":1,"b":{"c":2}};</script>`;
    expect(extractBalancedAfter(html, "window.__myx")).toBe('{"a":1,"b":{"c":2}}');
  });

  it("ignores braces that appear inside strings", () => {
    const html = `state = {"closing":"}","ok":true}`;
    expect(extractBalancedAfter(html, "state")).toBe('{"closing":"}","ok":true}');
  });

  it("extracts arrays when asked", () => {
    expect(extractBalancedAfter("data [1,2,[3]] end", "data", "[")).toBe("[1,2,[3]]");
  });

  it("returns null when the marker or opening bracket is absent", () => {
    expect(extractBalancedAfter("no marker here", "window.__myx")).toBeNull();
    expect(extractBalancedAfter("window.__myx = undefined", "window.__myx")).toBeNull();
  });
});
