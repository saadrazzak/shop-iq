import type { PriceResult } from "../../../shared/types";
import { getConfig } from "../../../config";
import { extractProductAttributes, matchProduct } from "../matching/product-matcher";
import { fetchJson } from "../http";

interface MeeshoCatalog {
  product_id?: string;
  name?: string;
  hero_product_name?: string;
  slug?: string;
  min_product_price?: number;
  min_catalog_price?: number;
  image?: string;
  product_images?: { url?: string }[];
}

/**
 * Searches Meesho (low-cost general goods) via its JSON search API. The
 * endpoint URL and request body type come from src/config/default-config.json.
 */
export async function searchMeesho(productTitle: string): Promise<PriceResult | null> {
  try {
    const { searchUrl, requestType } = getConfig().scrapers.meesho;
    const { searchResultLimit, requestTimeoutMs } = getConfig().thresholds;

    const data = await fetchJson<{ catalogs?: MeeshoCatalog[] }>(
      searchUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": "en-IN,en;q=0.9" },
        body: JSON.stringify({
          query: productTitle,
          type: requestType,
          page: 1,
          offset: 0,
          limit: searchResultLimit
        })
      },
      requestTimeoutMs
    );

    const catalogs: MeeshoCatalog[] = data?.catalogs ?? [];
    const originalAttrs = extractProductAttributes(productTitle);

    let best: PriceResult | null = null;
    for (const catalog of catalogs) {
      const name = catalog.name ?? catalog.hero_product_name;
      const price = catalog.min_product_price ?? catalog.min_catalog_price;
      if (!name || typeof price !== "number" || !catalog.slug || !catalog.product_id) continue;

      const confidence = matchProduct(productTitle, name, originalAttrs, extractProductAttributes(name));
      if (best && confidence <= best.confidenceScore) continue;

      best = {
        source: "Meesho",
        title: name,
        price,
        availability: "Check on Meesho",
        productUrl: `${getConfig().scrapers.meesho.productUrlBase}/${catalog.slug}/p/${catalog.product_id}`,
        imageUrl: catalog.product_images?.[0]?.url ?? catalog.image,
        confidenceScore: confidence
      };
    }

    return best;
  } catch (error) {
    console.error("Meesho scraper error:", error);
    return null;
  }
}
