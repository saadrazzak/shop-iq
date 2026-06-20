import { load } from "cheerio";
import type { RedditResult } from "../../../shared/types";
import { getConfig } from "../../../config";
import { buildSearchQuery, relevanceScore, tokenize } from "./query";
import { fetchText } from "../http";

function parseCount(text: string): number {
  const match = text.replace(/,/g, "").match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function toModernRedditUrl(url: string): string {
  const { oldUrlBase, modernUrlBase } = getConfig().reddit;
  if (url.startsWith(oldUrlBase)) return modernUrlBase + url.slice(oldUrlBase.length);
  const httpVariant = oldUrlBase.replace(/^https:/, "http:");
  if (url.startsWith(httpVariant)) return modernUrlBase + url.slice(httpVariant.length);
  return url;
}

/**
 * Searches old.reddit.com for product discussions. The search URL and HTML
 * selectors come from src/config/default-config.json, so they can be updated in
 * one place if Reddit changes their old-Reddit markup.
 */
export async function searchReddit(productTitle: string, brand?: string): Promise<RedditResult[]> {
  try {
    const { searchUrl, selectors } = getConfig().reddit;
    const { requestTimeoutMs, searchResultLimit, redditRelevanceMinScore } = getConfig().thresholds;

    const searchQuery = buildSearchQuery(productTitle);
    const queryTokens = tokenize(searchQuery);
    // When the brand is known, require it in the post title (the strongest signal).
    const brandTokens = brand ? tokenize(brand) : [];
    const url = `${searchUrl}?q=${encodeURIComponent(searchQuery)}&sort=relevance`;
    const html = await fetchText(url, {}, requestTimeoutMs);

    const $ = load(html);
    // Scored so we can keep only titles that cover enough of the product name and
    // surface the closest matches first. Reddit returns loosely-related posts for
    // niche products, so the match is against the post TITLE only (the subreddit
    // name would otherwise let a vague post in a relevant sub slip through).
    const scored: { result: RedditResult; relevance: number }[] = [];

    $(selectors.resultContainer).each((_, el) => {
      const titleLink = $(el).find(selectors.titleLink);
      const title = titleLink.text().trim();
      const postUrl = titleLink.attr("href");
      if (!title || !postUrl) return;

      const relevance = relevanceScore(queryTokens, title, brandTokens);
      if (relevance < redditRelevanceMinScore) return;

      const subreddit = $(el).find(selectors.subredditLink).text().trim() || "r/unknown";
      const score = parseCount($(el).find(selectors.score).text());
      const commentsCount = parseCount($(el).find(selectors.commentsLink).text());
      const createdAt = $(el).find("time").attr("datetime") ?? new Date().toISOString();
      const snippet = $(el).find(selectors.bodyParagraph).first().text().trim();

      scored.push({
        relevance,
        result: {
          title,
          subreddit,
          score,
          commentsCount,
          url: toModernRedditUrl(postUrl),
          createdAt,
          snippets: snippet ? [snippet] : []
        }
      });
    });

    const deduped = Array.from(
      new Map(scored.map((item) => [item.result.url, item])).values()
    ).sort((a, b) => b.relevance - a.relevance);

    return deduped.slice(0, searchResultLimit).map((item) => item.result);
  } catch (error) {
    console.error(`Reddit search error for "${productTitle}":`, error);
    return [];
  }
}
