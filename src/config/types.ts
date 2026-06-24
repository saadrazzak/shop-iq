export interface RemoteConfig {
  version: number;
  amazon: AmazonConfig;
  scrapers: ScrapersConfig;
  reddit: RedditConfig;
  youtube: YoutubeConfig;
  thresholds: ThresholdsConfig;
}

export interface AmazonConfig {
  selectors: AmazonSelectors;
  breadcrumbCategoryMap: [string, string][];
  urlPatterns: {
    productPage: string;
    reviewPage: string;
  };
  reviews: AmazonReviewsConfig;
  /** Substring (lowercased) that marks the nav account line as signed-out, e.g. "sign in". */
  signedOutText: string;
  seller: AmazonSellerConfig;
  assistant: AmazonAssistantConfig;
  pageOverlay: AmazonPageOverlayConfig;
}

export interface AmazonSellerConfig {
  /** Path + query prefix for the seller profile page, e.g. "/sp?seller=". */
  profileUrlBase: string;
  /** Query-param name carrying the seller id on the merchant link. */
  linkParamSeller: string;
  /** Query-param name carrying the fulfilled-by-Amazon flag. */
  linkParamFulfilled: string;
  /** Value of the fulfilled-by-Amazon flag that means "true". */
  fulfilledValue: string;
  selectors: {
    stateScript: string;
    feedbackRow: string;
    /** The id of the hidden feedback template row to exclude. */
    feedbackTemplateId: string;
    feedbackStars: string;
    feedbackMain: string;
    feedbackText: string;
    feedbackSuppressed: string;
    feedbackRater: string;
  };
  /** Maps each rating window to its `a-state` JSON key and the DOM id holding its average. */
  periods: { period: string; stateKey: string; averageId: string }[];
}

export interface AmazonAssistantConfig {
  searchInputId: string;
  submitButtonId: string;
  clearButtonSelector: string;
  responseSelector: string;
  paragraphSelector: string;
  listBlockSelector: string;
  priceHistoryPrompt: string;
  /** Separate, on-demand prompt for each week's lowest price over the last year (the 1-year tab) - the weekly low rather than an arbitrary daily snapshot, so a brief mid-week sale isn't missed at this sparser resolution. */
  priceHistoryYearlyPrompt: string;
  prosConsPrompt: string;
}

export interface AmazonPageOverlayConfig {
  bottomSheet: string;
  /** Aspect tab selector base; an `[aria-controls="…"]` suffix is appended at runtime. */
  aspectTabBase: string;
  reviewsContainer: string;
  /** Clicks this element to open Amazon's review photo gallery. */
  allPhotosTrigger: string;
  /** The popover overlay Amazon renders for the full photo gallery. */
  allPhotosPopover: string;
  /** Amazon's close button inside the photo gallery popover. */
  allPhotosPopoverClose: string;
}

export interface AmazonSelectors {
  productTitle: string;
  asinDetailBullets: string;
  brand: string;
  categoryDropdown: string;
  categoryDropdownSelected: string;
  categoryDropdownCurrentParent: string;
  breadcrumbFirstLink: string;
  mrp: string;
  discountPercent: string;
  priceWhole: string;
  priceOffscreen: string;
  priceBlockOurPrice: string;
  priceBlockDealPrice: string;
  ratingAcr: string;
  ratingHook: string;
  reviewCount: string;
  reviewContainer: string;
  reviewItems: string;
  reviewAuthor: string;
  reviewTitle: string;
  reviewBody: string;
  reviewStarRating: string;
  reviewVerifiedBadge: string;
  reviewDate: string;
  reviewHelpfulVote: string;
  reviewImageTile: string;
  reviewVideoWidget: string;
  reviewVideoDesktop: string;
  reviewVideoUrlInput: string;
  reviewVideoSlateInput: string;
  /** Selectors removed from a review body before reading its text (video player, image gallery, scripts). */
  reviewBodyStrip: string;
  showMoreReviewsButton: string;
  ratingHistogram: string;
  insightAspects: string;
  sellerLink: string;
  brandSnapshotFacts: string;
  navAccountLine: string;
  imagePrimary: string;
  imageWrapper: string;
  sponsoredCardSelectors: string[];
  carouselCard: string;
  carouselContainer: string;
  carouselHeading: string;
}

export interface AmazonReviewsConfig {
  urlBase: string;
  params: {
    encodingKey: string;
    ieKey: string;
    commonValue: string;
    pageNumberKey: string;
    reviewerTypeKey: string;
    verifiedValue: string;
    allReviewsValue: string;
    sortKey: string;
    recentSortValue: string;
    starFilterKey: string;
    mediaTypeKey: string;
    mediaOnlyValue: string;
  };
  starFilter: {
    five: string;
    four: string;
    three: string;
    two: string;
    one: string;
  };
}

export interface ScrapersConfig {
  croma: CromaScraperConfig;
  reliance: RelianceScraperConfig;
  myntra: MyntraScraperConfig;
  ajio: AjioScraperConfig;
  meesho: MeeshoScraperConfig;
}

export interface CromaScraperConfig {
  searchUrl: string;
  productUrlBase: string;
  params: {
    currentPage: string;
    fields: string;
    channel: string;
    channelCode: string;
    spellOpt: string;
  };
}

export interface RelianceScraperConfig {
  searchUrl: string;
  productUrlBase: string;
  applicationId: string;
  companyId: string;
}

export interface MyntraScraperConfig {
  searchUrlBase: string;
  stateVariable: string;
  stateResultPath: string;
}

export interface AjioScraperConfig {
  searchUrl: string;
  productUrlBase: string;
  params: {
    fields: string;
    currentPage: string;
  };
}

export interface MeeshoScraperConfig {
  searchUrl: string;
  productUrlBase: string;
  requestType: string;
}

export interface RedditConfig {
  searchUrl: string;
  oldUrlBase: string;
  modernUrlBase: string;
  selectors: {
    resultContainer: string;
    titleLink: string;
    subredditLink: string;
    score: string;
    commentsLink: string;
    bodyParagraph: string;
  };
}

export interface YoutubeConfig {
  searchUrl: string;
  watchUrlBase: string;
  initialDataVariable: string;
  resultsSectionPath: string;
  queryTemplates: string[];
}

export interface ThresholdsConfig {
  requestTimeoutMs: number;
  searchResultLimit: number;
  reviewScanPageLimit: number;
  /** Minimum title-coverage score (0–1) a Reddit post must meet to be kept. */
  redditRelevanceMinScore: number;
  /** Minimum daily entries before an AI price-history response is treated as a real list. */
  priceHistoryMinPoints: number;
  /** Minimum weekly entries before the on-demand 1-year response is treated as a real list. */
  priceHistoryYearlyMinPoints: number;
  confidence: { high: number; medium: number };
  buyScore: { positive: number; mixed: number };
}
