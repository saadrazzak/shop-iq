/**
 * Extracts the first balanced `{…}` object or `[…]` array that appears after
 * `marker` in `html`, respecting strings and nesting. Used to pull embedded
 * JSON state out of server-rendered pages (e.g. Myntra's `window.__myx`).
 * Returns the raw JSON string, or null if not found.
 */
export function extractBalancedAfter(html: string, marker: string, open: "{" | "[" = "{"): string | null {
  const close = open === "{" ? "}" : "]";
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) return null;

  const start = html.indexOf(open, markerIdx);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < html.length; i++) {
    const char = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === open) depth++;
    else if (char === close) {
      depth--;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  return null;
}
