import type { AnalysisResult, ProductData, ProductReview } from "../../../shared/types";
import { getConfig } from "../../../config";
import { NEGATIVE_TERMS, NEGATIVE_THEME_LABELS, POSITIVE_TERMS, POSITIVE_THEME_LABELS } from "./keywords";

// The buy score (0-100) is: a base from the rating, + a small confidence boost
// for having more reviews, + a sentiment signal from review keywords/ratings.
// The constants below tune each part; they're deliberately conservative so a
// thin sample never swings the score too hard.
const MAX_THEMES = 5;
/** Score used when there's neither a scanned review average nor a product rating. */
const NEUTRAL_BASE_SCORE = 55;
/** Star rating that counts as "neutral" — reviews above it push the score up, below it down. */
const RATING_BASELINE = 3.2;
/** Cap (±) on the keyword-sentiment contribution, so a keyword-stuffed review can't dominate. */
const KEYWORD_SIGNAL_RANGE = 20;
/** Points per net positive keyword (positive minus negative term hits). */
const KEYWORD_SIGNAL_WEIGHT = 4;
/** Points per star that the scanned average sits above/below RATING_BASELINE. */
const RATING_SIGNAL_WEIGHT = 16;
/** Base = scanned review average × this (preferred when reviews carry ratings). */
const SCANNED_RATING_MULTIPLIER = 18;
/** Base = product page rating × this (fallback when reviews have no ratings). */
const PRODUCT_RATING_MULTIPLIER = 16;
/** Max boost from the number of reviews actually scanned. */
const REVIEW_COUNT_BOOST_CAP = 10;
/** Boost per scanned review, up to REVIEW_COUNT_BOOST_CAP. */
const REVIEW_COUNT_BOOST_MULTIPLIER = 1.2;
/** Max boost from Amazon's total review count (popularity signal). */
const PAGE_REVIEW_COUNT_BOOST_CAP = 4;
/** Amazon review count is divided by this before being capped into the boost. */
const PAGE_REVIEW_COUNT_DIVISOR = 500;

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function parseRating(rating?: string): number | undefined {
  const match = rating?.match(/([0-5](?:\.\d)?)/);
  return match ? Number(match[1]) : undefined;
}

function countTerms(text: string, terms: string[]): number {
  const normalized = text.toLowerCase();
  return terms.reduce((count, term) => count + (normalized.includes(term) ? 1 : 0), 0);
}

function reviewText(review: ProductReview): string {
  return `${review.title ?? ""} ${review.body}`.trim();
}

function ratedReviews(reviews: ProductReview[]): ProductReview[] {
  return reviews.filter((review) => typeof review.rating === "number");
}

function averageRating(reviews: ProductReview[]): number | undefined {
  const rated = ratedReviews(reviews);
  if (rated.length === 0) return undefined;

  return rated.reduce((total, review) => total + (review.rating ?? 0), 0) / rated.length;
}

function reviewSignal(reviews: ProductReview[]): number {
  if (reviews.length === 0) return 0;

  const combinedReviews = reviews.map(reviewText).join(" ");
  const positiveCount = countTerms(combinedReviews, POSITIVE_TERMS);
  const negativeCount = countTerms(combinedReviews, NEGATIVE_TERMS);
  const averageReviewRating = averageRating(reviews);

  const keywordSignal = Math.max(
    -KEYWORD_SIGNAL_RANGE,
    Math.min(KEYWORD_SIGNAL_RANGE, (positiveCount - negativeCount) * KEYWORD_SIGNAL_WEIGHT)
  );
  const reviewRatingSignal = averageReviewRating
    ? (averageReviewRating - RATING_BASELINE) * RATING_SIGNAL_WEIGHT
    : 0;

  return keywordSignal + reviewRatingSignal;
}

function compactReviewThemes(
  reviews: ProductReview[],
  terms: string[],
  labels: Record<string, string>
): string[] {
  const matched = terms.filter((term) =>
    reviews.some((review) => reviewText(review).toLowerCase().includes(term))
  );

  return matched.slice(0, MAX_THEMES).map((term) => labels[term] ?? term);
}

function confidenceForReviewCount(count: number): "low" | "medium" | "high" {
  const { high, medium } = getConfig().thresholds.confidence;
  if (count >= high) return "high";
  if (count >= medium) return "medium";
  return "low";
}

function pickReview(reviews: ProductReview[], direction: "best" | "worst"): ProductReview | undefined {
  const reviewsWithBody = reviews.filter((review) => review.body.length > 0);
  if (reviewsWithBody.length === 0) return undefined;

  return [...reviewsWithBody].sort((left, right) => {
    const leftRating = left.rating ?? 3;
    const rightRating = right.rating ?? 3;
    return direction === "best" ? rightRating - leftRating : leftRating - rightRating;
  })[0];
}

function uniqueReviews(reviews: ProductReview[]): ProductReview[] {
  const seen = new Set<string>();

  return reviews.filter((review) => {
    const key = reviewText(review).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildVerdict(score: number): string {
  const { positive, mixed } = getConfig().thresholds.buyScore;
  if (score >= positive) {
    return "Visible reviews lean positive. Check the caution themes before deciding.";
  }
  if (score >= mixed) {
    return "Visible reviews are mixed. Read the worst review and repeated complaints before buying.";
  }
  return "Visible reviews raise enough concerns that this looks like a cautious or skip decision.";
}

/**
 * Produces a heuristic buy score and review summary from visible review text.
 * This is a keyword/rating-based analysis - no LLM is involved.
 */
export function localAnalysis(product: ProductData): AnalysisResult {
  const reviews = uniqueReviews(product.reviews);
  const rating = parseRating(product.rating);
  const reviewCount = Number(product.reviewCount?.replace(/[^\d]/g, "") || 0);
  const scannedAverageRating = averageRating(reviews);

  const baseScore = scannedAverageRating
    ? scannedAverageRating * SCANNED_RATING_MULTIPLIER
    : rating
      ? rating * PRODUCT_RATING_MULTIPLIER
      : NEUTRAL_BASE_SCORE;

  const confidenceBoost =
    Math.min(reviews.length * REVIEW_COUNT_BOOST_MULTIPLIER, REVIEW_COUNT_BOOST_CAP) +
    Math.min(reviewCount / PAGE_REVIEW_COUNT_DIVISOR, PAGE_REVIEW_COUNT_BOOST_CAP);

  const score = clampScore(baseScore + confidenceBoost + reviewSignal(reviews));
  const positiveThemes = compactReviewThemes(reviews, POSITIVE_TERMS, POSITIVE_THEME_LABELS);
  const negativeThemes = compactReviewThemes(reviews, NEGATIVE_TERMS, NEGATIVE_THEME_LABELS);
  const confidence = confidenceForReviewCount(reviews.length);

  return {
    buyScore: score,
    confidence,
    reviewsAnalyzed: reviews.length,
    averageReviewRating: scannedAverageRating ? Number(scannedAverageRating.toFixed(1)) : undefined,
    verdict: buildVerdict(score),
    pros: [
      reviews.length > 0
        ? `${reviews.length} review${reviews.length === 1 ? "" : "s"} scanned from visible Amazon pages.`
        : "No review text was available yet, so the score uses product-page metadata.",
      scannedAverageRating
        ? `Scanned reviews average ${scannedAverageRating.toFixed(1)} out of 5.`
        : rating
          ? `Amazon shows an overall rating of ${product.rating}.`
          : "The product title and page metadata were extracted.",
      positiveThemes.length > 0
        ? `Positive themes include ${positiveThemes.slice(0, 3).join(", ")}.`
        : "No obvious positive review themes were repeated in the visible text."
    ],
    cons: [
      reviews.length === 0
        ? "No visible review text was available on the page."
        : confidence === "low"
          ? "Only a small visible sample was analyzed."
          : "This analysis is limited to the reviews ShopIQ could visibly scan.",
      negativeThemes.length > 0
        ? `Caution themes include ${negativeThemes.slice(0, 3).join(", ")}.`
        : "No obvious caution keywords were repeated in the visible review text.",
      "This V1 does not include price history, seller risk, warranty, or payment checks."
    ],
    themes: {
      positive: positiveThemes,
      negative: negativeThemes
    },
    bestReview: pickReview(reviews, "best"),
    worstReview: pickReview(reviews, "worst")
  };
}
