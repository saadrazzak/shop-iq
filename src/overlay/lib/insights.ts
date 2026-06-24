/**
 * Maps the live `ProductData` (scraped from the Amazon page) and `AnalysisResult`
 * (from the backend) into the view-models the tabbed UI renders. Real product-page
 * signals (insight pills, rating histogram, top review titles) are preferred and
 * available immediately; backend analysis and mock fallbacks only fill the gaps.
 * Every fallback is annotated so it is obvious what is real vs. stubbed.
 */
import type { AnalysisResult, ProductData, ProductReview } from "../../shared/types";
import { PALETTE } from "./palette";
import type { PriceAlertTone } from "./priceHistory";

export type Tone = "positive" | "negative" | "mixed";

export type SentimentTag = {
  label: string;
  tone: Tone;
  /** Number of customer reviews mentioning this aspect, from Amazon's "Customers say" pill. */
  mentions?: number;
  /** `aria-controls` of this aspect's tab on the live page, used to trigger Amazon's own "show reviews" panel. */
  domAriaControls?: string;
};

export type RatingSegment = {
  label: string;
  percent: number;
  color: string;
};

export type RatedHighlight = {
  label: string;
  color: string;
  /** 1-5, rounded. Shown as a star-count badge next to the highlight. */
  rating: number;
  /** `id` of the matching review's element on the live product page, e.g. "R10BTOHS9OGPM4". */
  pageElementId?: string;
};

/** One ingredient of the donut score, for the "how is this calculated" tooltip. */
export type ScoreFactor = {
  label: string;
  /** e.g. "4.3★ → 86/100". */
  detail: string;
  /** Share of the blended score this factor contributes, e.g. 0.5 for 50%. */
  weight: number;
};

export type Verdict = {
  score: number;
  label: string;
  tagline: string;
  /** Whether the headline reads as a recommendation (brand) or caution (accent). */
  positive: boolean;
  /** Breakdown of what fed into `score`, for the donut's hover tooltip. */
  scoreFactors: ScoreFactor[];
};

const MAX_POSITIVE_TAGS = 3;
const MAX_NEGATIVE_TAGS = 2;
const MAX_MIXED_TAGS = 2;
const MAX_HIGHLIGHTS = 6;
const MAX_HIGHLIGHT_WORDS = 5;

const EXCELLENT_THRESHOLD = 85;
const WORTH_BUYING_THRESHOLD = 70;
const WORTH_CONSIDERING_THRESHOLD = 55;
const MIXED_BAG_THRESHOLD = 40;

/** How much each signal contributes to the donut score. Rating and price only count when that data is available - see `combineScores`. */
const ASPECT_SCORE_WEIGHT = 0.5;
const RATING_SCORE_WEIGHT = 0.3;
const PRICE_SCORE_WEIGHT = 0.2;

/** Score contribution (0-100) for each price-vs-history tone, from `getPriceAlert`. */
const PRICE_TONE_SCORES: Record<PriceAlertTone, number> = {
  low: 90,
  same: 55,
  high: 20
};

/** Red -> green scale for a 1-5 star rating (1 = red, 5 = darkest green). */
const RATING_COLORS: Record<number, string> = {
  1: "#dc2626",
  2: "#f87171",
  3: "#86efac",
  4: "#22c55e",
  5: "#15803d"
};

/** Title-cases a short theme phrase for use as a tag/highlight label. */
function toLabel(phrase: string): string {
  const trimmed = phrase.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function joinList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** Maps a 1-5 star rating to a color on the red (1★) -> green (5★) scale. */
export function ratingToColor(rating: number): string {
  const rounded = Math.min(5, Math.max(1, Math.round(rating)));
  return RATING_COLORS[rounded];
}

/** Sentiment-tone colors for "Customers say" pills: green/red/neutral. */
const TONE_COLORS: Record<Tone, string> = {
  positive: RATING_COLORS[5],
  negative: RATING_COLORS[1],
  mixed: PALETTE.slate
};

/** Maps a sentiment tone to its semantic color (green/red/neutral). */
export function toneToColor(tone: Tone): string {
  return TONE_COLORS[tone];
}

function labelForScore(score: number): string {
  if (score >= EXCELLENT_THRESHOLD) return "Excellent buy";
  if (score >= WORTH_BUYING_THRESHOLD) return "Worth buying";
  if (score >= WORTH_CONSIDERING_THRESHOLD) return "Worth considering";
  if (score >= MIXED_BAG_THRESHOLD) return "Mixed bag";
  return "Think twice";
}

/** Weighted average of whichever scores are available (0-100 each), re-normalized over just the present weights. Falls back to a neutral 50 if nothing is available. */
function combineScores(parts: ({ value: number; weight: number } | undefined)[]): number {
  const present = parts.filter((part): part is { value: number; weight: number } => part !== undefined);
  const totalWeight = present.reduce((sum, part) => sum + part.weight, 0);
  if (totalWeight === 0) return 50;

  const weighted = present.reduce((sum, part) => sum + part.value * part.weight, 0) / totalWeight;
  return Math.max(0, Math.min(100, Math.round(weighted)));
}

/** Short factual note on how the current price compares to its recent history - appended to the tagline so the score's price component is explained. */
function priceClause(priceTone?: PriceAlertTone): string | undefined {
  if (priceTone === "low") return "It's also priced low for this product right now.";
  if (priceTone === "high") return "Heads up: it's currently priced on the high side.";
  return undefined;
}

function appendClause(tagline: string, clause: string | undefined): string {
  if (!clause) return tagline;
  return tagline ? `${tagline} ${clause}` : clause;
}

/** Plain-language description of a price tone, for the score tooltip. */
function priceToneLabel(priceTone: PriceAlertTone, windowDays: number): string {
  if (priceTone === "low") return `current low vs ${windowDays}d history`;
  if (priceTone === "high") return `current high vs ${windowDays}d history`;
  return `typical vs ${windowDays}d history`;
}

/** Builds the "how is this calculated" breakdown for the donut tooltip, including only the signals actually used. `windowDays` (default 30) labels the price factor with however much history it was actually computed over. */
function buildScoreFactors(
  sentimentScore: number,
  averageRating: number | undefined,
  ratingScore: number | undefined,
  priceTone: PriceAlertTone | undefined,
  priceScore: number | undefined,
  windowDays = 30
): ScoreFactor[] {
  const factors: ScoreFactor[] = [
    { label: "Customer sentiment", detail: `${sentimentScore}/100`, weight: ASPECT_SCORE_WEIGHT }
  ];

  if (averageRating !== undefined && ratingScore !== undefined) {
    factors.push({
      label: "Average rating",
      detail: `${averageRating.toFixed(1)}★ → ${ratingScore}/100`,
      weight: RATING_SCORE_WEIGHT
    });
  }

  if (priceTone !== undefined && priceScore !== undefined) {
    factors.push({
      label: `Price vs. ${windowDays}-day history`,
      detail: `${priceToneLabel(priceTone, windowDays)} → ${priceScore}/100`,
      weight: PRICE_SCORE_WEIGHT
    });
  }

  return factors;
}

export function getVerdict(analysis: AnalysisResult): Verdict {
  const score = Math.max(0, Math.min(100, Math.round(analysis.buyScore)));
  return {
    score,
    label: labelForScore(score),
    tagline: analysis.verdict,
    positive: score >= WORTH_CONSIDERING_THRESHOLD,
    scoreFactors: buildScoreFactors(score, undefined, undefined, undefined, undefined)
  };
}

/** Sentiment tags derived from the backend's analysis themes (fallback only). */
function getThemeTags(analysis: AnalysisResult): SentimentTag[] {
  const positives = analysis.themes.positive
    .slice(0, MAX_POSITIVE_TAGS)
    .map((phrase): SentimentTag => ({ label: toLabel(phrase), tone: "positive" }));
  const negatives = analysis.themes.negative
    .slice(0, MAX_NEGATIVE_TAGS)
    .map((phrase): SentimentTag => ({ label: toLabel(phrase), tone: "negative" }));
  return [...positives, ...negatives];
}

/**
 * "Worth buying" verdict. The donut score blends three signals: the share of
 * positive "Customers say" pills on the product page, the overall star
 * rating, and how the current price compares to its recent history
 * (`priceTone` from `getPriceAlert`). Rating and price only count toward the
 * score once that data is available - see `combineScores`. `windowDays`
 * (default 30) should be the same window `priceTone` was computed over, so
 * the score tooltip's "vs. N-day history" label stays accurate.
 */
export function getWorthBuyingVerdict(
  product?: ProductData,
  analysis?: AnalysisResult,
  priceTone?: PriceAlertTone,
  windowDays = 30
): Verdict {
  const aspects = product?.insightAspects;
  const averageRating = getAverageRating(product, analysis);
  const ratingScore = averageRating !== undefined ? Math.round((averageRating / 5) * 100) : undefined;
  const priceScore = priceTone !== undefined ? PRICE_TONE_SCORES[priceTone] : undefined;
  const priceNote = priceClause(priceTone);

  if (aspects && aspects.length > 0) {
    const positive = aspects.filter((aspect) => aspect.tone === "positive");
    const negative = aspects.filter((aspect) => aspect.tone === "negative");
    const mixed = aspects.filter((aspect) => aspect.tone === "mixed");
    // Mixed aspects count as half-credit toward the aspect score.
    const aspectScore = Math.round(((positive.length + mixed.length * 0.5) / aspects.length) * 100);
    const score = combineScores([
      { value: aspectScore, weight: ASPECT_SCORE_WEIGHT },
      ratingScore !== undefined ? { value: ratingScore, weight: RATING_SCORE_WEIGHT } : undefined,
      priceScore !== undefined ? { value: priceScore, weight: PRICE_SCORE_WEIGHT } : undefined
    ]);

    let tagline = analysis?.verdict ?? "";
    if (!tagline) {
      const topPositive = positive.slice(0, MAX_POSITIVE_TAGS).map((aspect) => aspect.label.toLowerCase());
      const topNegative = negative.slice(0, MAX_NEGATIVE_TAGS).map((aspect) => aspect.label.toLowerCase());
      const topMixed = mixed.slice(0, MAX_MIXED_TAGS).map((aspect) => aspect.label.toLowerCase());

      if (topPositive.length > 0 && topNegative.length > 0) {
        tagline = `Buyers love ${joinList(topPositive)}, but flag ${joinList(topNegative)}.`;
      } else if (topPositive.length > 0) {
        tagline = `Buyers consistently praise ${joinList(topPositive)}.`;
      } else if (topNegative.length > 0) {
        tagline = `Buyers commonly mention issues with ${joinList(topNegative)}.`;
      }

      if (topMixed.length > 0) {
        const mixedNote = `opinions are split on ${joinList(topMixed)}`;
        tagline = tagline ? `${tagline} Also, ${mixedNote}.` : `Buyers have ${mixedNote}.`;
      }
    }

    return {
      score,
      label: labelForScore(score),
      tagline: appendClause(tagline, priceNote),
      positive: score >= WORTH_CONSIDERING_THRESHOLD,
      scoreFactors: buildScoreFactors(aspectScore, averageRating, ratingScore, priceTone, priceScore, windowDays)
    };
  }

  if (analysis) {
    const base = getVerdict(analysis);
    const score = combineScores([
      { value: base.score, weight: ASPECT_SCORE_WEIGHT },
      ratingScore !== undefined ? { value: ratingScore, weight: RATING_SCORE_WEIGHT } : undefined,
      priceScore !== undefined ? { value: priceScore, weight: PRICE_SCORE_WEIGHT } : undefined
    ]);
    return {
      score,
      label: labelForScore(score),
      tagline: appendClause(base.tagline, priceNote),
      positive: score >= WORTH_CONSIDERING_THRESHOLD,
      scoreFactors: buildScoreFactors(base.score, averageRating, ratingScore, priceTone, priceScore, windowDays)
    };
  }

  // Stub: neither insight pills nor an analysis are available yet.
  const baseScore = 75;
  const score = combineScores([
    { value: baseScore, weight: ASPECT_SCORE_WEIGHT },
    ratingScore !== undefined ? { value: ratingScore, weight: RATING_SCORE_WEIGHT } : undefined,
    priceScore !== undefined ? { value: priceScore, weight: PRICE_SCORE_WEIGHT } : undefined
  ]);
  return {
    score,
    label: labelForScore(score),
    tagline: appendClause("Analyzing customer feedback…", priceNote),
    positive: score >= WORTH_CONSIDERING_THRESHOLD,
    scoreFactors: buildScoreFactors(baseScore, averageRating, ratingScore, priceTone, priceScore, windowDays)
  };
}

/**
 * Sentiment tags for the "Worth buying" card, from the real "Customers say"
 * insight pills. Falls back to the backend's analysis themes.
 */
export function getInsightTags(product?: ProductData, analysis?: AnalysisResult): SentimentTag[] {
  const aspects = product?.insightAspects;
  if (aspects && aspects.length > 0) {
    return aspects.map((aspect) => ({
      label: aspect.label,
      tone: aspect.tone,
      mentions: aspect.mentions,
      domAriaControls: aspect.domAriaControls
    }));
  }

  if (analysis) return getThemeTags(analysis);
  return [];
}

/**
 * Pros come from the brand snapshot card (always available) and fall back to
 * rating/review signals. Cons are only shown when the user is signed in to
 * Amazon (AI insights available); otherwise an empty array is returned so the
 * UI can hide the cons section entirely.
 */
export function getProsAndCons(
  product?: ProductData,
  analysis?: AnalysisResult
): { pros: string[]; cons: string[] } {
  const pros: string[] = [];
  const cons: string[] = [];

  // --- Pros ---
  // Brand snapshot card facts (e.g. "83% positive ratings from 50K+ customers")
  if (product?.brandFacts && product.brandFacts.length > 0) {
    pros.push(...product.brandFacts.slice(0, 3));
  } else {
    // Fallback: derive from brand name + rating
    if (product?.brand) pros.push(`Trusted brand: ${product.brand}`);
    const avgRating = getAverageRating(product, analysis);
    if (avgRating !== undefined && avgRating > 4) {
      pros.push(`Highly rated by buyers: ${avgRating.toFixed(1)}★ average`);
    }
    if (pros.length === 0 && analysis) pros.push(...analysis.pros);
  }

  // --- Cons (only when signed in) ---
  if (product?.isSignedIn === false) return { pros, cons };

  // 1. Negative "Customers say" aspects (most reliable — Amazon's own signals)
  const negativeAspects = (product?.insightAspects ?? []).filter((a) => a.tone === "negative");
  for (const aspect of negativeAspects.slice(0, 3)) {
    cons.push(`Buyers flag concerns about: ${aspect.label.toLowerCase()}`);
  }

  // 2. Keyword-matched negative themes from review text
  if (cons.length < 3 && analysis?.themes.negative.length) {
    for (const theme of analysis.themes.negative.slice(0, 3 - cons.length)) {
      cons.push(toLabel(theme));
    }
  }

  // 3. Low-star signal from the rating distribution
  if (cons.length < 3 && product?.ratingDistribution) {
    const lowStarPct = product.ratingDistribution
      .filter((bar) => bar.stars <= 2)
      .reduce((sum, bar) => sum + bar.percent, 0);
    if (lowStarPct >= 15) {
      cons.push(`${lowStarPct}% of buyers gave 1–2 stars`);
    }
  }

  return { pros, cons };
}

/** Parses a rating like "4.7 out of 5 stars" or "4.7" into a number. */
export function getAverageRating(product?: ProductData, analysis?: AnalysisResult): number | undefined {
  // Product page rating is authoritative (all reviews); scanned average is a
  // small sample so we only use it as a last resort when the page rating is absent.
  const match = product?.rating?.match(/([0-5](?:\.\d)?)/);
  if (match) return Number(match[1]);
  return analysis?.averageReviewRating;
}

/**
 * Rating distribution computed from the ratings on the extracted reviews when
 * the real histogram isn't available; otherwise a representative mock.
 */
function getFallbackRatingDistribution(product?: ProductData): RatingSegment[] {
  const buckets = [0, 0, 0, 0, 0]; // index 0 => 1 star ... index 4 => 5 star
  let counted = 0;

  for (const review of product?.reviews ?? []) {
    if (typeof review.rating === "number" && review.rating >= 1 && review.rating <= 5) {
      buckets[Math.round(review.rating) - 1] += 1;
      counted += 1;
    }
  }

  if (counted === 0) {
    // Stub: no per-review ratings were extracted and no histogram was found.
    return [
      { label: "5 star", percent: 68, color: ratingToColor(5) },
      { label: "4 star", percent: 18, color: ratingToColor(4) },
      { label: "3 star", percent: 7, color: ratingToColor(3) },
      { label: "2 star", percent: 4, color: ratingToColor(2) },
      { label: "1 star", percent: 3, color: ratingToColor(1) }
    ];
  }

  const pct = (count: number) => Math.round((count / counted) * 100);
  return [5, 4, 3, 2, 1].map((stars) => ({
    label: `${stars} star`,
    percent: pct(buckets[stars - 1]),
    color: ratingToColor(stars)
  }));
}

/**
 * Star-rating distribution for the Summary tab's rating breakdown bar.
 * Prefers the real per-star percentages scraped from Amazon's rating
 * histogram; falls back to a distribution computed from extracted reviews,
 * then to a stub.
 */
export function getRealRatingBreakdown(product?: ProductData): RatingSegment[] {
  const distribution = product?.ratingDistribution;
  if (distribution && distribution.length > 0) {
    return [5, 4, 3, 2, 1].map((stars) => ({
      label: `${stars} star`,
      percent: distribution.find((bar) => bar.stars === stars)?.percent ?? 0,
      color: ratingToColor(stars)
    }));
  }

  return getFallbackRatingDistribution(product);
}

function shortenTitle(title: string): string {
  const words = title.trim().split(/\s+/);
  if (words.length <= MAX_HIGHLIGHT_WORDS) return title.trim();
  return `${words.slice(0, MAX_HIGHLIGHT_WORDS).join(" ")}…`;
}

/**
 * Highlight pills for the Rating breakdown card: top review titles, colored
 * by that review's star rating (red for 1★ up to dark green for 5★). Falls
 * back to a representative stub when no titled/rated reviews were extracted.
 */
export function getReviewHighlights(product?: ProductData): RatedHighlight[] {
  const highlights = (product?.reviews ?? [])
    .filter(
      (review): review is ProductReview & { title: string; rating: number } =>
        Boolean(review.title) && typeof review.rating === "number"
    )
    .slice(0, MAX_HIGHLIGHTS)
    .map((review) => ({
      label: shortenTitle(review.title),
      color: ratingToColor(review.rating),
      rating: Math.round(review.rating),
      pageElementId: review.domId
    }));

  if (highlights.length > 0) return highlights;

  // Stub: no titled/rated reviews were extracted.
  return [
    { label: "Great battery life", color: ratingToColor(5), rating: 5 },
    { label: "Excellent camera", color: ratingToColor(4), rating: 4 },
    { label: "A bit pricy", color: ratingToColor(2), rating: 2 }
  ];
}

// Re-export PALETTE so view components that previously imported it from here
// (e.g. for the donut track color) keep working without an extra import.
export { PALETTE };
