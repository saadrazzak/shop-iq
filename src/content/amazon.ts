import type { InsightAspect, ProductCategory, ProductData, ProductReview, ProductSeller, RatingBar } from "../shared/types";
import { getConfig } from "../config";

function text(selector: string): string | undefined {
  const value = document.querySelector(selector)?.textContent?.trim();
  return value?.replace(/\s+/g, " ");
}

function attr(selector: string, attribute: string): string | undefined {
  return document.querySelector(selector)?.getAttribute(attribute) ?? undefined;
}

function parseRating(value?: string): number | undefined {
  if (!value) return undefined;
  const match = value.match(/([0-5](?:\.\d)?)/);
  return match ? Number(match[1]) : undefined;
}

function getAsin(): string | undefined {
  const urlMatch = window.location.href.match(
    new RegExp(getConfig().amazon.urlPatterns.productPage, "i")
  );
  const detailMatch = document
    .querySelector(getConfig().amazon.selectors.asinDetailBullets)
    ?.textContent?.match(/\b[A-Z0-9]{10}\b/);

  return urlMatch?.[1] ?? detailMatch?.[0];
}

function getVisibleReviews(): ProductReview[] {
  const { reviewContainer, reviewItems } = getConfig().amazon.selectors;
  const container = document.querySelector(reviewContainer) ?? document;
  return Array.from(container.querySelectorAll(reviewItems))
    .slice(0, 8)
    .map((review) => extractReview(review, "product-page"))
    .filter((review) => review.body.length > 0);
}

/** Brand from the product overview table (data-csa-c-content-id="product-overview-classic"). */
function getBrand(): string | undefined {
  return clean(document.querySelector(getConfig().amazon.selectors.brand)?.textContent);
}

const ALL_CATEGORIES: ProductCategory = { alias: "all", label: "All Categories" };

/**
 * The product's department, from the "Search in" dropdown (`#searchDropdownBox`).
 * The selected `<option value="search-alias=electronics">Electronics</option>`
 * gives us a stable alias we can route to retailers. Falls back to the
 * breadcrumb's top crumb mapped to a known alias, then to "all" (search
 * everywhere) when nothing is found.
 *
 * The dropdown selectors and keyword→alias map come from
 * src/config/default-config.json, so they can be updated if Amazon changes its markup.
 */
function getCategory(): ProductCategory {
  const { categoryDropdownSelected, categoryDropdownCurrentParent, breadcrumbFirstLink } =
    getConfig().amazon.selectors;

  const option =
    document.querySelector<HTMLOptionElement>(categoryDropdownSelected) ??
    document.querySelector<HTMLOptionElement>(categoryDropdownCurrentParent) ??
    document.querySelector<HTMLSelectElement>(getConfig().amazon.selectors.categoryDropdown)?.selectedOptions?.[0] ??
    null;

  const alias = option?.getAttribute("value")?.match(/search-alias=([\w-]+)/)?.[1];
  const label = clean(option?.textContent);

  if (alias && alias !== "aps" && label) {
    return { alias, label };
  }

  const crumb = clean(document.querySelector(breadcrumbFirstLink)?.textContent);
  if (crumb) {
    const crumbLower = crumb.toLowerCase();
    const mapped = getConfig().amazon.breadcrumbCategoryMap.find(([kw]) => crumbLower.includes(kw));
    return { alias: mapped ? mapped[1] : "all", label: crumb };
  }

  return ALL_CATEGORIES;
}

/** Struck-through "M.R.P." price next to the current price, e.g. "₹49,999". */
function getMrp(): string | undefined {
  const value = clean(document.querySelector(getConfig().amazon.selectors.mrp)?.textContent);
  const match = value?.match(/₹[\d,]+(?:\.\d+)?/);
  return match?.[0];
}

/** Savings badge, e.g. "-5%". */
function getDiscountPercent(): string | undefined {
  return clean(document.querySelector(getConfig().amazon.selectors.discountPercent)?.textContent);
}

/** Whole-rupee price from the buy box, e.g. "47,350" -> "₹47,350". */
function getPriceFromWhole(): string | undefined {
  const whole = clean(
    document.querySelector(getConfig().amazon.selectors.priceWhole)?.firstChild?.textContent
  );
  return whole ? `₹${whole}` : undefined;
}

/**
 * Real per-star percentages from the rating histogram
 * (data-csa-c-content-id="customerReviews").
 */
function getRatingDistribution(): RatingBar[] | undefined {
  const links = document.querySelectorAll(getConfig().amazon.selectors.ratingHistogram);

  const bars: RatingBar[] = [];
  for (const link of links) {
    const match = link.getAttribute("aria-label")?.match(/(\d+) percent of reviews have (\d) star/);
    if (match) bars.push({ stars: Number(match[2]), percent: Number(match[1]) });
  }

  return bars.length > 0 ? bars.sort((a, b) => b.stars - a.stars) : undefined;
}

/**
 * "Customers say" aspect pills, each labelled e.g. "Positive aspect, quality,
 * 15 mentions" or "Mixed aspect, battery life, 24 mentions".
 */
function getInsightAspects(): InsightAspect[] | undefined {
  const tabs = document.querySelectorAll(getConfig().amazon.selectors.insightAspects);

  const aspects: InsightAspect[] = [];
  for (const tab of tabs) {
    const match = tab
      .getAttribute("aria-label")
      ?.match(/^(Positive|Negative|Mixed) aspect, (.+), (\d+) mentions?$/i);
    if (!match) continue;

    const [, sentiment, label, mentions] = match;
    aspects.push({
      label: toLabel(label),
      tone: sentiment.toLowerCase() as InsightAspect["tone"],
      mentions: Number(mentions),
      domAriaControls: tab.getAttribute("aria-controls") ?? undefined
    });
  }

  return aspects.length > 0 ? aspects : undefined;
}

function toLabel(phrase: string): string {
  const trimmed = phrase.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Bullet-point texts from Amazon's brand snapshot card. */
function getBrandFacts(): string[] | undefined {
  const items = document.querySelectorAll(getConfig().amazon.selectors.brandSnapshotFacts);
  const facts = Array.from(items)
    .map((el) => el.textContent?.replace(/\s+/g, " ").trim() ?? "")
    .filter(Boolean);
  return facts.length > 0 ? facts : undefined;
}

/** The third-party (or Amazon) seller, parsed from the merchant-info link. */
function getSeller(): ProductSeller | undefined {
  const link = document.querySelector<HTMLAnchorElement>(getConfig().amazon.selectors.sellerLink);
  const name = clean(link?.textContent);
  const href = link?.getAttribute("href");
  if (!name || !href) return undefined;

  const { linkParamSeller, linkParamFulfilled, fulfilledValue } = getConfig().amazon.seller;
  const params = new URLSearchParams(href.split("?")[1] ?? "");
  const id = params.get(linkParamSeller);
  if (!id) return undefined;

  return { id, name, fulfilledByAmazon: params.get(linkParamFulfilled) === fulfilledValue };
}

/** True when the Amazon nav shows a signed-in account name (not "sign in"). */
function getIsSignedIn(): boolean {
  const navLine =
    document.querySelector(getConfig().amazon.selectors.navAccountLine)?.textContent?.toLowerCase() ?? "";
  return navLine.length > 0 && !navLine.includes(getConfig().amazon.signedOutText);
}

function clean(value?: string | null): string | undefined {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  return cleaned || undefined;
}

/**
 * Strips Amazon's image size token so we load the full-res original. Handles both
 * forms: `._SY500_.jpg` (inline PDP, trailing underscore) and `._SY88.jpg`
 * (review page, no trailing underscore). The image id never contains a dot, so we
 * remove the `._<token>` segment that sits right before the file extension.
 */
function toFullResImage(url: string): string {
  return url.replace(/\._[^./]+(\.(?:jpg|jpeg|png|gif|webp))(\?.*)?$/i, "$1");
}

/** Full-resolution URLs for the customer photos attached to a review. */
function getReviewImages(review: Element): string[] {
  const tiles = review.querySelectorAll<HTMLImageElement>(getConfig().amazon.selectors.reviewImageTile);
  const urls = Array.from(tiles)
    .map((img) => img.getAttribute("src") ?? "")
    .filter(Boolean)
    .map(toFullResImage);
  return Array.from(new Set(urls));
}

/**
 * A review's customer video. Two markups exist:
 *  - Inline PDP: `[data-hook="reviewVideo"]` with a `data-widget-model` JSON blob
 *    that only carries an HLS (.m3u8) stream — not directly playable, so we keep
 *    just the poster and link out.
 *  - Review page: `.cr-video-desktop` plus a hidden `.video-url` input holding a
 *    real `.mp4` we can render inline.
 */
function getReviewVideo(review: Element): { thumbnail?: string; url?: string } | undefined {
  const sel = getConfig().amazon.selectors;

  // Inline PDP format.
  const model = review.querySelector(sel.reviewVideoWidget)?.getAttribute("data-widget-model");
  if (model) {
    try {
      const parsed = JSON.parse(model) as { initialVideo?: { thumbnailImgUrl?: string } };
      const thumb = parsed.initialVideo?.thumbnailImgUrl;
      if (thumb) return { thumbnail: toFullResImage(thumb) };
    } catch {
      // fall through to the review-page format
    }
  }

  // Review-page format.
  const crVideo = review.querySelector(sel.reviewVideoDesktop);
  const mp4 = review.querySelector<HTMLInputElement>(sel.reviewVideoUrlInput)?.value;
  const slate = review.querySelector<HTMLInputElement>(sel.reviewVideoSlateInput)?.value;
  const thumb = crVideo?.getAttribute("data-thumbnail-url") || slate;
  if (thumb || mp4) {
    return {
      thumbnail: thumb ? toFullResImage(thumb) : undefined,
      url: mp4 && /\.mp4(\?|$)/i.test(mp4) ? mp4 : undefined
    };
  }
  return undefined;
}

/**
 * Plain review text, with any nested video player / image gallery / inline
 * `<script>` stripped first. On review pages the video block lives *inside*
 * `[data-hook="review-body"]`, so its JSON config would otherwise leak into the
 * body text.
 */
function getReviewBody(review: Element, selector: string): string {
  const el = review.querySelector(selector);
  if (!el) return "";
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(getConfig().amazon.selectors.reviewBodyStrip).forEach((node) => node.remove());
  return clean(clone.textContent) ?? "";
}

function extractReview(review: Element, source: ProductReview["source"]): ProductReview {
  const sel = getConfig().amazon.selectors;
  const title = clean(review.querySelector(sel.reviewTitle)?.textContent);
  const body = getReviewBody(review, sel.reviewBody);
  const ratingText = clean(review.querySelector(sel.reviewStarRating)?.textContent);
  const verifiedText = clean(review.querySelector(sel.reviewVerifiedBadge)?.textContent);
  const images = getReviewImages(review);
  const video = getReviewVideo(review);

  return {
    title,
    body,
    rating: parseRating(ratingText),
    date: clean(review.querySelector(sel.reviewDate)?.textContent),
    author: clean(review.querySelector(sel.reviewAuthor)?.textContent),
    verified: verifiedText ? /verified/i.test(verifiedText) : undefined,
    helpfulText: clean(review.querySelector(sel.reviewHelpfulVote)?.textContent),
    hasMedia: images.length > 0 || Boolean(video),
    images: images.length > 0 ? images : undefined,
    videoThumbnail: video?.thumbnail,
    videoUrl: video?.url,
    domId: review.id || undefined,
    source
  };
}

export function isAmazonProductPage(): boolean {
  return new RegExp(getConfig().amazon.urlPatterns.productPage, "i").test(window.location.href);
}

export function isAmazonReviewPage(): boolean {
  return new RegExp(getConfig().amazon.urlPatterns.reviewPage, "i").test(window.location.href);
}

export function extractAmazonProduct(): ProductData | undefined {
  if (!isAmazonProductPage()) return undefined;

  const sel = getConfig().amazon.selectors;
  const title = text(sel.productTitle);
  if (!title) return undefined;

  return {
    source: "amazon.in",
    asin: getAsin(),
    title,
    brand: getBrand(),
    category: getCategory(),
    price:
      text(sel.priceOffscreen) ??
      getPriceFromWhole() ??
      text(sel.priceBlockOurPrice) ??
      text(sel.priceBlockDealPrice),
    mrp: getMrp(),
    discountPercent: getDiscountPercent(),
    rating: text(sel.ratingAcr) ?? text(sel.ratingHook),
    reviewCount: text(sel.reviewCount),
    ratingDistribution: getRatingDistribution(),
    insightAspects: getInsightAspects(),
    brandFacts: getBrandFacts(),
    isSignedIn: getIsSignedIn(),
    seller: getSeller(),
    imageUrl: attr(sel.imagePrimary, "src") ?? attr(sel.imageWrapper, "src"),
    url: window.location.href,
    reviews: getVisibleReviews(),
    extractedAt: new Date().toISOString()
  };
}

/**
 * Extracts every review under `root` (a live `document`, or a `Document`/element
 * parsed from fetched review-page HTML). Shared by the on-page scrape and the
 * no-redirect fetch-based scan.
 */
export function extractReviewsFrom(
  root: ParentNode,
  source: ProductReview["source"] = "review-page"
): ProductReview[] {
  return Array.from(root.querySelectorAll(getConfig().amazon.selectors.reviewItems)).map((review) =>
    extractReview(review, source)
  );
}

export function extractAmazonReviewPageReviews(): ProductReview[] {
  if (!isAmazonReviewPage()) return [];
  return extractReviewsFrom(document).filter((review) => review.body.length > 0);
}
