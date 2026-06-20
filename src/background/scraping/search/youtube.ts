import type { YoutubeResult } from "../../../shared/types";
import { getConfig, resolveByPath } from "../../../config";
import { fetchText } from "../http";

function buildQueries(productTitle: string): string[] {
  return getConfig().youtube.queryTemplates.map((t) => t.replace("{title}", productTitle));
}

function toYoutubeResult(videoRenderer: Record<string, unknown>): YoutubeResult | undefined {
  const videoId = videoRenderer.videoId as string | undefined;
  const title = (videoRenderer.title as { runs?: { text: string }[] })?.runs?.[0]?.text;
  const channel = (videoRenderer.ownerText as { runs?: { text: string }[] })?.runs?.[0]?.text;
  const views = (videoRenderer.viewCountText as { simpleText?: string })?.simpleText;
  const publishedTime = (videoRenderer.publishedTimeText as { simpleText?: string })?.simpleText;
  const duration = (videoRenderer.lengthText as { simpleText?: string })?.simpleText;
  const thumbnailUrl = (videoRenderer.thumbnail as { thumbnails?: { url: string }[] })?.thumbnails?.[0]?.url;

  if (!videoId || !title || !channel || !views || !publishedTime) return undefined;

  return {
    title,
    channel,
    views,
    publishedTime,
    url: `${getConfig().youtube.watchUrlBase}${videoId}`,
    videoId,
    thumbnailUrl,
    duration
  };
}

/**
 * Scrapes a YouTube search results page for review/unboxing videos. YouTube
 * embeds its results as a JSON blob server-side, so this works without an API
 * key or login. The variable name and deep results path come from
 * src/config/default-config.json, so they can be updated in one place.
 */
async function searchYoutubeQuery(query: string): Promise<YoutubeResult[]> {
  try {
    const { searchUrl, initialDataVariable, resultsSectionPath } = getConfig().youtube;
    const { requestTimeoutMs } = getConfig().thresholds;

    const url = `${searchUrl}?search_query=${encodeURIComponent(query)}`;
    const html = await fetchText(url, {}, requestTimeoutMs);

    const pattern = new RegExp(`var ${initialDataVariable} = (\\{.*?\\});<\\/script>`, "s");
    const match = html.match(pattern);
    if (!match) return [];

    const data = JSON.parse(match[1]) as Record<string, unknown>;
    const sections =
      (resolveByPath(data, resultsSectionPath) as Record<string, unknown>[] | undefined) ?? [];

    const results: YoutubeResult[] = [];
    for (const section of sections) {
      const items =
        ((section.itemSectionRenderer as Record<string, unknown> | undefined)?.contents as
          | Record<string, unknown>[]
          | undefined) ?? [];
      for (const item of items) {
        if (!item.videoRenderer) continue;
        const result = toYoutubeResult(item.videoRenderer as Record<string, unknown>);
        if (result) results.push(result);
      }
    }

    return results;
  } catch (error) {
    console.error(`YouTube search error for "${query}":`, error);
    return [];
  }
}

/**
 * Finds review/unboxing videos for a product by scraping YouTube search.
 */
export async function searchYoutube(productTitle: string): Promise<YoutubeResult[]> {
  const allResults: YoutubeResult[] = [];

  for (const query of buildQueries(productTitle)) {
    allResults.push(...(await searchYoutubeQuery(query)));
  }

  return Array.from(new Map(allResults.map((item) => [item.videoId, item])).values()).slice(
    0,
    getConfig().thresholds.searchResultLimit
  );
}
