/** Parses YouTube's formatted view-count text, e.g. "46,880 views" or "1.2M views". */
export function parseViewCount(views: string): number {
  const match = views.replace(/,/g, "").match(/([\d.]+)\s*([KM]?)/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const suffix = match[2].toUpperCase();
  if (suffix === "K") return value * 1_000;
  if (suffix === "M") return value * 1_000_000;
  return value;
}

/** Formats a YouTube view count compactly, e.g. "12000 views" -> "12k views". */
export function formatViewCount(views: string): string {
  const count = parseViewCount(views);
  const compact = (value: number) => value.toFixed(1).replace(/\.0$/, "");

  if (count >= 1_000_000) return `${compact(count / 1_000_000)}m views`;
  if (count >= 1_000) return `${compact(count / 1_000)}k views`;
  return `${Math.round(count)} views`;
}
