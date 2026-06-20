import type { PriceResult } from "../../../shared/types";
import { buildSearchQuery } from "../search/query";
import { searchCroma } from "./croma";
import { searchRelianceDigital } from "./reliance-digital";
import { searchMyntra } from "./myntra";
import { searchAjio } from "./ajio";
import { searchMeesho } from "./meesho";

export type SourceId = "croma" | "reliance" | "myntra" | "ajio" | "meesho";

const SOURCES: Record<SourceId, (productTitle: string) => Promise<PriceResult | null>> = {
  croma: searchCroma,
  reliance: searchRelianceDigital,
  myntra: searchMyntra,
  ajio: searchAjio,
  meesho: searchMeesho
};

const ALL_SOURCES: SourceId[] = ["croma", "reliance", "myntra", "ajio", "meesho"];

/**
 * Maps an Amazon `search-alias` to the retailers worth querying for it:
 * electronics → Croma/Reliance; fashion → Myntra/Ajio; beauty & home → Myntra/
 * Meesho. A headphone has no presence on Myntra and a lipstick none on Croma,
 * so routing by category avoids wasted requests and false matches. Unlisted
 * aliases (and the "all"/"aps" department) fall back to every source —
 * confidence + price-sanity filtering then drops the noise.
 */
const ELECTRONICS: SourceId[] = ["croma", "reliance"];
const FASHION: SourceId[] = ["myntra", "ajio"];
const LIFESTYLE: SourceId[] = ["myntra", "meesho"];

const CATEGORY_SOURCES: Record<string, SourceId[]> = {
  // Electronics, mobiles, laptops, appliances
  electronics: ELECTRONICS,
  computers: ELECTRONICS,
  appliances: ELECTRONICS,
  "amazon-devices": ELECTRONICS,
  videogames: ELECTRONICS,
  // Fashion, footwear, accessories
  fashion: FASHION,
  apparel: FASHION,
  shoes: FASHION,
  watches: FASHION,
  jewelry: FASHION,
  luggage: FASHION,
  // Beauty, personal care, home, kitchen, general
  beauty: LIFESTYLE,
  "luxury-beauty": LIFESTYLE,
  hpc: LIFESTYLE,
  kitchen: LIFESTYLE,
  furniture: LIFESTYLE,
  "home-improvement": LIFESTYLE,
  lawngarden: LIFESTYLE,
  pets: LIFESTYLE,
  toys: LIFESTYLE,
  baby: LIFESTYLE,
  sporting: LIFESTYLE,
  automotive: ["meesho"],
  "office-products": ["meesho"]
};

/** Which retailers to search for a given Amazon category alias. */
export function sourcesForCategory(alias?: string): SourceId[] {
  if (!alias || alias === "all" || alias === "aps") return ALL_SOURCES;
  return CATEGORY_SOURCES[alias] ?? ALL_SOURCES;
}

/**
 * Searches the retailers relevant to `categoryAlias` in parallel and returns
 * matching results sorted by confidence (desc), then price (asc). Each source
 * is isolated with `allSettled`, so one site throwing or being blocked never
 * affects the others. Amazon is intentionally excluded (the shopper is already
 * on it).
 *
 * The full Amazon marketing title (e.g. "iQOO Neo 10 (Alpine White, 8GB RAM,
 * 256GB) | Segment's Fastest Processor* | 120W FlashCharge | ...") makes
 * retailer search APIs 404 and tanks match scoring, so we search with the
 * trimmed core product name. Variant detection still uses the full title back
 * in the pricing service.
 */
export async function comparePrices(productTitle: string, categoryAlias?: string): Promise<PriceResult[]> {
  const sourceIds = sourcesForCategory(categoryAlias);
  const query = buildSearchQuery(productTitle);

  const settled = await Promise.allSettled(sourceIds.map((id) => SOURCES[id](query)));

  return settled
    .map((outcome) => (outcome.status === "fulfilled" ? outcome.value : null))
    .filter((result): result is PriceResult => result !== null)
    .sort((a, b) => {
      if (b.confidenceScore !== a.confidenceScore) return b.confidenceScore - a.confidenceScore;
      return a.price - b.price;
    });
}
