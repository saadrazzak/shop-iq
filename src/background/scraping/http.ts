/**
 * Minimal fetch wrappers for the scrapers. Adds an AbortController timeout so
 * a hung retailer API doesn't stall the whole comparison.
 *
 * Browser-forbidden request headers (User-Agent, Referer, Origin, sec-ch-ua…)
 * passed in `headers` are silently ignored by the browser. Where a retailer
 * needs a specific Referer/Origin, it's set via the declarativeNetRequest
 * ruleset in public/dnr-rules.json, not here.
 */
async function timedFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET/POST a URL and parse the JSON body. Throws on non-OK status.
 * Pass `{ nullOn404: true }` to treat HTTP 404 as "no results" (returns null)
 * instead of throwing — useful for APIs like Croma's that return 404 for empty
 * result sets rather than an empty array.
 */
export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit = {},
  timeoutMs: number,
  options: { nullOn404?: boolean } = {}
): Promise<T | null> {
  const response = await timedFetch(url, init, timeoutMs);
  if (options.nullOn404 && response.status === 404) return null;
  if (!response.ok) throw new Error(`Request to ${url} failed with status ${response.status}`);
  return response.json() as Promise<T>;
}

/** GET a URL and return the raw text body (for HTML-embedded JSON blobs). */
export async function fetchText(url: string, init: RequestInit = {}, timeoutMs: number): Promise<string> {
  const response = await timedFetch(url, init, timeoutMs);
  if (!response.ok) throw new Error(`Request to ${url} failed with status ${response.status}`);
  return response.text();
}
