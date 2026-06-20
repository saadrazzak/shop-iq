/**
 * Pulls a number out of a display string such as `"₹47,350"` or `"4.3"` by
 * dropping every character that isn't a digit or a dot. Returns `undefined`
 * when the input is missing or contains no numeric characters at all (so a
 * non-price string never collapses to a misleading `0`).
 */
export function parseNumericValue(value?: string): number | undefined {
  if (!value) return undefined;
  const digits = value.replace(/[^0-9.]/g, "");
  if (!digits) return undefined;
  const numeric = Number(digits);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function formatCurrency(value?: number): string {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "INR"
  }).format(value);
}

export function formatRupees(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}
