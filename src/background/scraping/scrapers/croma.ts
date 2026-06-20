import type { PriceResult } from "../../../shared/types";
import { getConfig } from "../../../config";
import { extractProductAttributes, matchProduct } from "../matching/product-matcher";
import { fetchJson } from "../http";

interface CromaProduct {
  name?: string;
  url?: string;
  plpImage?: string;
  price?: { value?: number };
  mrp?: { value?: number };
}

/**
 * Searches Croma via its storefront search API (`api.croma.com`). Endpoint
 * URL and query params come from src/config/default-config.json, so they can be
 * updated if Croma changes their API.
 */
export async function searchCroma(productTitle: string): Promise<PriceResult | null> {
  try {
    const { searchUrl, params } = getConfig().scrapers.croma;
    const url =
      `${searchUrl}?currentPage=${params.currentPage}` +
      `&query=${encodeURIComponent(`${productTitle}:relevance`)}` +
      `&fields=${params.fields}&pageSize=${getConfig().thresholds.searchResultLimit}` +
      `&channel=${params.channel}&channelCode=${params.channelCode}&spellOpt=${params.spellOpt}`;

    const data = await fetchJson<{ products?: CromaProduct[] }>(
      url,
      { headers: { Accept: "application/json", "Accept-Language": "en-US,en;q=0.9" } },
      getConfig().thresholds.requestTimeoutMs,
      { nullOn404: true }
    );

    const products: CromaProduct[] = data?.products ?? [];
    const originalAttrs = extractProductAttributes(productTitle);

    let best: PriceResult | null = null;
    for (const product of products) {
      const price = product.price?.value;
      if (!product.name || !product.url || typeof price !== "number") continue;

      const confidence = matchProduct(
        productTitle,
        product.name,
        originalAttrs,
        extractProductAttributes(product.name)
      );
      if (best && confidence <= best.confidenceScore) continue;

      best = {
        source: "Croma",
        title: product.name,
        price,
        originalPrice: product.mrp?.value,
        availability: "Check on Croma",
        productUrl: product.url.startsWith("http") ? product.url : `${getConfig().scrapers.croma.productUrlBase}${product.url}`,
        imageUrl: product.plpImage,
        confidenceScore: confidence
      };
    }

    return best;
  } catch (error) {
    console.error("Croma scraper error:", error);
    return null;
  }
}
