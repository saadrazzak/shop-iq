import type { PriceResult } from "../../../shared/types";
import { getConfig } from "../../../config";
import { extractProductAttributes, matchProduct } from "../matching/product-matcher";
import { fetchJson } from "../http";

interface AjioProduct {
  name?: string;
  code?: string;
  url?: string;
  price?: { value?: number };
  wasPriceData?: { value?: number };
  images?: { url?: string }[];
}

/**
 * Searches Ajio (fashion) via its JSON search API. The endpoint URL and query
 * params (fields, currentPage) come from src/config/default-config.json.
 */
export async function searchAjio(productTitle: string): Promise<PriceResult | null> {
  try {
    const { searchUrl, params } = getConfig().scrapers.ajio;
    const { searchResultLimit, requestTimeoutMs } = getConfig().thresholds;

    const url =
      `${searchUrl}?fields=${params.fields}&query=${encodeURIComponent(productTitle)}` +
      `&currentPage=${params.currentPage}&pageSize=${searchResultLimit}`;

    const data = await fetchJson<{ products?: AjioProduct[] }>(
      url,
      { headers: { Accept: "application/json, text/plain, */*", "Accept-Language": "en-IN,en;q=0.9" } },
      requestTimeoutMs
    );

    const products: AjioProduct[] = data?.products ?? [];
    const originalAttrs = extractProductAttributes(productTitle);

    let best: PriceResult | null = null;
    for (const product of products) {
      const price = product.price?.value;
      const link = product.url;
      if (!product.name || typeof price !== "number" || !link) continue;

      const confidence = matchProduct(
        productTitle,
        product.name,
        originalAttrs,
        extractProductAttributes(product.name)
      );
      if (best && confidence <= best.confidenceScore) continue;

      best = {
        source: "Ajio",
        title: product.name,
        price,
        originalPrice: product.wasPriceData?.value,
        availability: "Check on Ajio",
        productUrl: link.startsWith("http") ? link : `${getConfig().scrapers.ajio.productUrlBase}${link}`,
        imageUrl: product.images?.[0]?.url,
        confidenceScore: confidence
      };
    }

    return best;
  } catch (error) {
    console.error("Ajio scraper error:", error);
    return null;
  }
}
