import type { PriceResult } from "../../../shared/types";
import { getConfig, resolveByPath } from "../../../config";
import { extractProductAttributes, matchProduct } from "../matching/product-matcher";
import { extractBalancedAfter } from "./util";
import { fetchText } from "../http";

interface MyntraProduct {
  brand?: string;
  product?: string;
  productName?: string;
  price?: number;
  mrp?: number;
  landingPageUrl?: string;
  searchImage?: string;
}

/**
 * Searches Myntra (fashion). Myntra server-side renders search results into a
 * `window.__myx` JSON blob. The state variable name and the result path within
 * it come from src/config/default-config.json, so they can be updated if Myntra
 * renames the variable or restructures the state object.
 */
export async function searchMyntra(productTitle: string): Promise<PriceResult | null> {
  try {
    const { searchUrlBase, stateVariable, stateResultPath } = getConfig().scrapers.myntra;
    const { requestTimeoutMs } = getConfig().thresholds;

    const searchUrl = `${searchUrlBase}/${encodeURIComponent(productTitle)}?rawQuery=${encodeURIComponent(productTitle)}`;

    const html = await fetchText(
      searchUrl,
      {
        headers: {
          "Accept-Language": "en-IN,en;q=0.9",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      },
      requestTimeoutMs
    );

    const json = extractBalancedAfter(html, `window.${stateVariable}`);
    if (!json) return null;

    const state = JSON.parse(json);
    const products: MyntraProduct[] = (resolveByPath(state, stateResultPath) as MyntraProduct[]) ?? [];
    const originalAttrs = extractProductAttributes(productTitle);

    let best: PriceResult | null = null;
    for (const product of products) {
      const name = [product.brand, product.productName ?? product.product].filter(Boolean).join(" ").trim();
      const price = product.price;
      if (!name || typeof price !== "number" || !product.landingPageUrl) continue;

      const confidence = matchProduct(productTitle, name, originalAttrs, extractProductAttributes(name));
      if (best && confidence <= best.confidenceScore) continue;

      best = {
        source: "Myntra",
        title: name,
        price,
        originalPrice: product.mrp,
        availability: "Check on Myntra",
        productUrl: `${getConfig().scrapers.myntra.searchUrlBase}/${product.landingPageUrl}`,
        imageUrl: product.searchImage,
        confidenceScore: confidence
      };
    }

    return best;
  } catch (error) {
    console.error("Myntra scraper error:", error);
    return null;
  }
}
