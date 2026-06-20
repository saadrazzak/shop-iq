import type { ReviewScanOptions } from "./types";
import { getConfig } from "../config";

/**
 * The review URL for the chosen options and page. Params are omitted when at
 * their default to mirror Amazon's own URLs.
 *
 * The URL base, all query parameter names, and all query parameter values come
 * from src/config/default-config.json, so they can be updated if Amazon changes
 * their review page URL structure or parameter names.
 */
export function buildReviewUrl(asin: string, options: ReviewScanOptions, page = 1): string {
  const { urlBase, params, starFilter } = getConfig().amazon.reviews;

  const url = new URL(`${urlBase}${asin}/`);
  url.searchParams.set(params.encodingKey, params.commonValue);
  url.searchParams.set(params.ieKey, params.commonValue);
  url.searchParams.set(params.pageNumberKey, String(page));
  url.searchParams.set(
    params.reviewerTypeKey,
    options.verifiedOnly ? params.verifiedValue : params.allReviewsValue
  );

  if (options.sort === "recent") url.searchParams.set(params.sortKey, params.recentSortValue);

  const starValue = starFilter[options.star as keyof typeof starFilter];
  if (starValue) url.searchParams.set(params.starFilterKey, starValue);

  if (options.mediaOnly) url.searchParams.set(params.mediaTypeKey, params.mediaOnlyValue);

  return url.toString();
}
