export type ProductReview = {
  title?: string;
  body: string;
  rating?: number;
  date?: string;
  author?: string;
  verified?: boolean;
  helpfulText?: string;
  hasMedia?: boolean;
  /** Full-resolution customer photo URLs attached to this review. */
  images?: string[];
  /** Poster thumbnail of a customer video, if the review has one. */
  videoThumbnail?: string;
  /** Direct playable video URL (e.g. .mp4) when Amazon exposes one — review pages do, inline PDP only offers HLS. */
  videoUrl?: string;
  source?: "product-page" | "review-page";
  /** The `id` attribute of this review's element on the live product page, e.g. "R10BTOHS9OGPM4". */
  domId?: string;
};

/** Real per-star percentage from Amazon's rating histogram. */
export type RatingBar = {
  stars: number;
  percent: number;
};

/** A "Customers say" insight pill, e.g. "Positive aspect, quality, 15 mentions". */
export type InsightAspect = {
  label: string;
  tone: "positive" | "negative" | "mixed";
  mentions: number;
  /** `aria-controls` of this aspect's tab on the live page, used to trigger Amazon's own "show reviews" panel. */
  domAriaControls?: string;
};

/** The Amazon department the product sits in, read from the "Search in" dropdown. `alias` is Amazon's `search-alias` (e.g. "electronics"); "all" means All Categories. */
export type ProductCategory = {
  alias: string;
  label: string;
};

/** The seller of a product, identified from the PDP merchant-info link. */
export type ProductSeller = {
  /** Amazon seller id, e.g. "A1WYWER0W24N8S". */
  id: string;
  name: string;
  /** Whether the offer is fulfilled by Amazon (from the merchant link's isAmazonFulfilled flag). */
  fulfilledByAmazon?: boolean;
};

/** One time-window of a seller's feedback ratings (e.g. last 30 days). */
export type SellerRatingPeriod = {
  period: "30d" | "90d" | "365d" | "lifetime";
  /** Average star rating, e.g. 4.6. */
  average?: number;
  /** Total number of ratings in this window. */
  ratingCount?: number;
  /** Per-star percentage breakdown (5★ → 1★). */
  histogram: RatingBar[];
};

/** A single seller feedback entry scraped from the seller profile page. */
export type SellerFeedbackItem = {
  stars: number;
  text: string;
  author?: string;
  date?: string;
  /** True when Amazon took responsibility (struck-through "fulfilled by Amazon" note). */
  amazonResponsibility?: boolean;
};

/** Full seller scorecard fetched from the seller profile (/sp) page. */
export type SellerInfo = {
  sellerId: string;
  name: string;
  fulfilledByAmazon?: boolean;
  /** Seller profile URL on Amazon. */
  url: string;
  /** Rating windows, ordered 30d → lifetime. */
  periods: SellerRatingPeriod[];
  /** A handful of recent feedback entries. */
  feedback: SellerFeedbackItem[];
  fetchedAt: number;
};

export type ProductData = {
  source: "amazon.in";
  asin?: string;
  title: string;
  brand?: string;
  category?: ProductCategory;
  price?: string;
  /** Struck-through "M.R.P." price, e.g. "₹49,999". */
  mrp?: string;
  /** Savings percentage, e.g. "-5%". */
  discountPercent?: string;
  rating?: string;
  reviewCount?: string;
  /** Real 5/4/3/2/1-star percentages from Amazon's rating histogram. */
  ratingDistribution?: RatingBar[];
  /** "Customers say" aspect pills (quality, battery life, etc.) with sentiment. */
  insightAspects?: InsightAspect[];
  /** Bullet points from Amazon's brand snapshot card (e.g. "83% positive ratings from 50K+ customers"). */
  brandFacts?: string[];
  /** Whether the Amazon session appears to be signed in (detected from the nav bar). */
  isSignedIn?: boolean;
  /** The third-party (or Amazon) seller this product is sold by, from the merchant-info link. */
  seller?: ProductSeller;
  imageUrl?: string;
  url: string;
  reviews: ProductReview[];
  extractedAt: string;
};

export type AnalysisResult = {
  buyScore: number;
  confidence: "low" | "medium" | "high";
  reviewsAnalyzed: number;
  averageReviewRating?: number;
  verdict: string;
  pros: string[];
  cons: string[];
  themes: {
    positive: string[];
    negative: string[];
  };
  bestReview?: ProductReview;
  worstReview?: ProductReview;
};

/** Progress of an in-flight multi-page review scan, for the Reviews-tab status. */
export type ReviewScanProgress = {
  /** Page currently being scanned (1-based). */
  page: number;
  /** Total pages this scan will crawl. */
  pageLimit: number;
};

export type ProductState = {
  product?: ProductData;
  analysis?: AnalysisResult;
  error?: string;
  status: "idle" | "product-found" | "analyzing" | "opening-reviews" | "complete" | "error";
  /** Set while a deeper review scan is crawling pages. */
  scanProgress?: ReviewScanProgress;
};

/** Persisted overlay UI state, so it survives the scan's page navigations. */
export type OverlayUi = {
  open: boolean;
  /** Active tab id (matches the overlay's `TabId`). */
  activeTab: string;
};

/** The most recent review scan's fetched reviews and the filter used to get them. */
export type ScanResult = {
  reviews: ProductReview[];
  options: ReviewScanOptions;
};

export type PriceResult = {
  source: string;
  title: string;
  price: number;
  originalPrice?: number;
  availability?: string;
  productUrl: string;
  imageUrl?: string;
  confidenceScore: number;
};

/** How confident we are that a scraped listing is the same product. */
export type PriceConfidence = "high" | "medium" | "low";

/** A retailer's live price, with a human-readable confidence band. `match` is
 * "exact" for the same variant, "variant" for the same product in a different
 * size/colour/storage. */
export type RetailerPrice = PriceResult & {
  confidence: PriceConfidence;
  match: "exact" | "variant";
};

/** Result of a live price comparison from the backend `/api/prices` endpoint. */
export type PriceComparison = {
  query: string;
  prices: RetailerPrice[];
  fetchedAt: string;
  cached: boolean;
  error?: string;
};

export type RedditResult = {
  title: string;
  subreddit: string;
  score: number;
  commentsCount: number;
  url: string;
  createdAt: string;
  snippets: string[];
};

export type YoutubeResult = {
  title: string;
  channel: string;
  views: string;
  publishedTime: string;
  url: string;
  videoId: string;
  thumbnailUrl?: string;
  duration?: string;
};

export type ComparisonResult = {
  prices: PriceResult[];
  reddit: RedditResult[];
  youtube: YoutubeResult[];
  error?: string;
  loading?: boolean;
};

/** Sort order for the deeper review scan: Amazon's "Top reviews" vs "Most recent". */
export type ReviewSort = "top" | "recent";

/** Star-rating filter for the deeper scan ("all" = no filter). */
export type ReviewStar = "all" | "five" | "four" | "three" | "two" | "one";

/** Options chosen in the "Analyze more reviews" card, mapped to Amazon's review-page query params. */
export type ReviewScanOptions = {
  sort: ReviewSort;
  /** Limit to verified-purchase reviews (reviewerType=avp_only_reviews). */
  verifiedOnly: boolean;
  star: ReviewStar;
  /** Limit to reviews with photos/videos (mediaType=media_reviews_only). */
  mediaOnly: boolean;
};

export type ExtensionMessage =
  | { type: "SHOPIQ_PRODUCT_EXTRACTED"; product: ProductData }
  | { type: "SHOPIQ_NON_PRODUCT_PAGE" }
  | { type: "SHOPIQ_PAGE_LOADED"; isProductPage: boolean }
  | { type: "SHOPIQ_REVIEW_BATCH_EXTRACTED"; reviews: ProductReview[]; pageUrl: string }
  | { type: "SHOPIQ_REVIEW_PAGE_READY" }
  | { type: "SHOPIQ_REVIEW_SCAN_PROGRESS"; page: number }
  | { type: "SHOPIQ_GET_STATE" }
  | { type: "SHOPIQ_ANALYZE_PRODUCT"; product?: ProductData }
  | { type: "SHOPIQ_SHOW_OVERLAY" }
  | { type: "SHOPIQ_OPEN_REVIEW_PAGE"; options: ReviewScanOptions }
  | { type: "SHOPIQ_SET_UI"; ui: Partial<OverlayUi> }
  | { type: "SHOPIQ_STATE"; state: ProductState }
  | { type: "SHOPIQ_GET_COMPARISONS"; product: ProductData }
  | { type: "SHOPIQ_COMPARISONS_RESULT"; result: ComparisonResult }
  | { type: "SHOPIQ_GET_PRICES"; product: ProductData; forceRefresh?: boolean };
