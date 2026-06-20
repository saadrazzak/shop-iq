import type { PriceResult } from "../../../shared/types";
import { getConfig } from "../../../config";
import { extractProductAttributes, matchProduct } from "../matching/product-matcher";
import { fetchJson } from "../http";

interface FyndItem {
  name?: string;
  slug?: string;
  medias?: { url?: string }[];
  price?: {
    effective?: { min?: number };
    marked?: { min?: number };
  };
}

/**
 * Searches Reliance Digital via its Fynd-platform storefront API. The
 * applicationId and companyId are public Fynd identifiers (sent by
 * reliancedigital.in on every search) and live in src/config/default-config.json,
 * so they can be updated if Reliance migrates their Fynd instance.
 */
export async function searchRelianceDigital(productTitle: string): Promise<PriceResult | null> {
  try {
    const { searchUrl, applicationId, companyId } = getConfig().scrapers.reliance;
    const { searchResultLimit, requestTimeoutMs } = getConfig().thresholds;

    const url = `${searchUrl}?q=${encodeURIComponent(productTitle)}&page_size=${searchResultLimit}`;

    const data = await fetchJson<{ items?: FyndItem[] }>(
      url,
      {
        headers: {
          Accept: "application/json",
          "x-application-id": applicationId,
          "x-company-id": companyId
        }
      },
      requestTimeoutMs
    );

    const items: FyndItem[] = data?.items ?? [];
    const originalAttrs = extractProductAttributes(productTitle);

    let best: PriceResult | null = null;
    for (const item of items) {
      const price = item.price?.effective?.min;
      if (!item.name || !item.slug || typeof price !== "number") continue;

      const confidence = matchProduct(
        productTitle,
        item.name,
        originalAttrs,
        extractProductAttributes(item.name)
      );
      if (best && confidence <= best.confidenceScore) continue;

      best = {
        source: "Reliance Digital",
        title: item.name,
        price,
        originalPrice: item.price?.marked?.min,
        availability: "Check on Reliance Digital",
        productUrl: `${getConfig().scrapers.reliance.productUrlBase}/${item.slug}`,
        imageUrl: item.medias?.[0]?.url,
        confidenceScore: confidence
      };
    }

    return best;
  } catch (error) {
    console.error("Reliance Digital scraper error:", error);
    return null;
  }
}
