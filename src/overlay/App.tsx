import { useEffect, useState } from "react";
import { OverlayChrome } from "./components/OverlayChrome";
import { EmptyState } from "./components/EmptyState";
import { buildTabs, type TabId } from "./components/tabs";
import { SummaryTab } from "./components/summary/SummaryTab";
import { PriceHistoryTab } from "./components/price-history/PriceHistoryTab";
import { ReviewsTab } from "./components/reviews/ReviewsTab";
import { SocialTab } from "./components/social/SocialTab";
import { SettingsTab } from "./components/settings/SettingsTab";
import { useComparisons } from "./hooks/useComparisons";
import { usePrices } from "./hooks/usePrices";
import type { usePriceHistory } from "./hooks/usePriceHistory";
import { getAverageRating } from "./lib/insights";
import { formatCurrency, parseNumericValue } from "../shared/utils/format";
import type { ProductState, ReviewScanOptions, ReviewScanProgress, ScanResult } from "../shared/types";

/** Cap on how long the heavy retailer/social fetches wait for price history before running anyway. */
const HEAVY_FETCH_MAX_WAIT_MS = 10000;

type AppProps = {
  state: ProductState;
  scanResult?: ScanResult;
  /** True while review pages are being fetched in place. */
  scanning?: boolean;
  scanProgress?: ReviewScanProgress;
  analyzeSnapshot: () => Promise<void>;
  analyzeMoreReviews: (options: ReviewScanOptions) => Promise<void>;
  priceHistory: ReturnType<typeof usePriceHistory>;
  /** Whether the user has consented to querying Amazon's AI assistant (Rufus). */
  rufusEnabled: boolean;
  /** Grants Rufus consent (from the in-tab consent prompts). */
  onEnableRufus: () => void;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onClose: () => void;
};

export default function App({
  state,
  scanResult,
  scanning,
  scanProgress,
  analyzeSnapshot,
  analyzeMoreReviews,
  priceHistory,
  rufusEnabled,
  onEnableRufus,
  activeTab,
  onTabChange,
  onClose
}: AppProps) {
  // Hold the heavy retailer/social scraping until the on-page AI price-history
  // request has settled, so it doesn't starve Rufus's streaming of the main
  // thread while the overlay is open. Capped so it never waits too long.
  const priceHistorySettled =
    priceHistory.state.status === "ready" ||
    priceHistory.state.status === "error" ||
    priceHistory.state.status === "disabled";
  const [heavyAllowed, setHeavyAllowed] = useState(false);
  useEffect(() => {
    if (priceHistorySettled) {
      setHeavyAllowed(true);
      return;
    }
    const timeoutId = window.setTimeout(() => setHeavyAllowed(true), HEAVY_FETCH_MAX_WAIT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [priceHistorySettled]);

  const { comparisons, loading: loadingComparisons } = useComparisons(state.product, heavyAllowed);
  const prices = usePrices(state.product, heavyAllowed);

  const product = state.product;
  const analysis = state.analysis;
  const isBusy = state.status === "analyzing" || Boolean(scanning);

  const averageRating = getAverageRating(product, analysis);
  const socialCount = comparisons.reddit.length + comparisons.youtube.length;

  const tabs = buildTabs({
    rating: averageRating?.toFixed(1),
    social: socialCount
  });

  const currentPrice = parseNumericValue(product?.price);
  // Best deal = cheapest high-confidence exact match (a wrong product or a
  // different variant surfaced as a cheaper "deal" would be misleading).
  const bestPrice = (prices.comparison?.prices ?? [])
    .filter((entry) => entry.confidence === "high" && entry.match === "exact")
    .sort((a, b) => a.price - b.price)[0];
  const bestDeal = bestPrice
    ? { store: bestPrice.source, price: formatCurrency(bestPrice.price), url: bestPrice.productUrl }
    : undefined;

  function renderTab() {
    if (activeTab === "settings") return <SettingsTab />;
    if (!product) return <EmptyState />;

    switch (activeTab) {
      case "summary":
        return (
          <SummaryTab
            product={product}
            analysis={analysis}
            priceHistory={priceHistory.state}
            onViewPriceHistory={() => onTabChange("price-history")}
            rufusEnabled={rufusEnabled}
            onEnableRufus={onEnableRufus}
          />
        );
      case "price-history":
        return (
          <PriceHistoryTab
            state={priceHistory.state}
            onRefresh={priceHistory.refresh}
            prices={prices}
            currentPrice={currentPrice}
            onRefreshPrices={prices.refresh}
            onEnableRufus={onEnableRufus}
            asin={product.asin}
          />
        );
      case "reviews":
        return (
          <ReviewsTab
            product={product}
            analysis={analysis}
            isBusy={isBusy}
            error={state.error}
            scanProgress={scanProgress}
            scanResult={scanResult}
            onAnalyze={analyzeSnapshot}
            onAnalyzeMore={analyzeMoreReviews}
          />
        );
      case "social":
        return <SocialTab comparisons={comparisons} loading={loadingComparisons} />;
      default:
        return null;
    }
  }

  return (
    <OverlayChrome
      onClose={onClose}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      productName={product?.title}
      bestDeal={bestDeal}
    >
      {renderTab()}
    </OverlayChrome>
  );
}
