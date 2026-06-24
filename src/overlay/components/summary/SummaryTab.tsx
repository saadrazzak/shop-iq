import { useRef, useState } from "react";
import type { AnalysisResult, ProductData } from "../../../shared/types";
import type { PriceHistoryState } from "../../hooks/usePriceHistory";
import { useSellerRating } from "../../hooks/useSellerRating";
import { useAssistantProsCons } from "../../hooks/useAssistantProsCons";
import {
  getAverageRating,
  getInsightTags,
  getProsAndCons,
  getRealRatingBreakdown,
  getReviewHighlights,
  getWorthBuyingVerdict
} from "../../lib/insights";
import { getPriceAlert } from "../../lib/priceHistory";
import { ProductHero } from "./ProductHero";
import { WorthBuyingCard } from "./WorthBuyingCard";
import { ProsConsCard } from "./ProsConsCard";
import { RatingBreakdownCard } from "./RatingBreakdownCard";
import { SellerCard } from "../seller/SellerCard";
import { SellerDetail } from "../seller/SellerDetail";

type SummaryTabProps = {
  product: ProductData;
  analysis?: AnalysisResult;
  /** Price history loaded in the background via Amazon's AI assistant. */
  priceHistory: PriceHistoryState;
  /** Switches the overlay to the Price History tab. */
  onViewPriceHistory?: () => void;
  /** Whether the user has consented to querying Amazon's AI assistant (Rufus). */
  rufusEnabled: boolean;
  /** Grants Rufus consent (from the pros/cons consent prompt). */
  onEnableRufus: () => void;
};

export function SummaryTab({
  product,
  analysis,
  priceHistory,
  onViewPriceHistory,
  rufusEnabled,
  onEnableRufus
}: SummaryTabProps) {
  const averageRating = getAverageRating(product, analysis);
  const fallback = getProsAndCons(product, analysis);

  // Pros/cons are a separate, on-demand AI prompt (fetched when the section is
  // expanded) so the price-history request stays short and fast. Until they
  // arrive — or if they fail — the page-derived fallback is shown.
  const prosCons = useAssistantProsCons(product);
  const aiProsCons = prosCons.state.status === "ready" ? prosCons.state.data : undefined;
  const usingAiPros = !!aiProsCons?.pros.length;
  const pros = usingAiPros ? aiProsCons!.pros : fallback.pros;
  const cons = aiProsCons?.cons.length ? aiProsCons.cons : fallback.cons;
  const prosConsLoading = prosCons.state.status === "loading";
  // Show "View on page" link when pros are brand-snapshot fallback (not from AI).
  const prosPageSelector =
    !usingAiPros && product.isSignedIn === false && product.brandFacts?.length
      ? ".brand-snapshot-flex-row"
      : undefined;

  const priceData = priceHistory.status === "ready" ? priceHistory.data : undefined;
  const priceTone = priceData ? getPriceAlert(priceData.stats).tone : undefined;
  const ratingBreakdownRef = useRef<HTMLDivElement>(null);

  const seller = useSellerRating(product.seller);
  const [sellerDetailOpen, setSellerDetailOpen] = useState(false);

  function scrollToHighlights() {
    ratingBreakdownRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div data-testid="shopiq-summary-tab" className="flex flex-col gap-3 p-3.5">
      <ProductHero product={product} onViewPriceHistory={onViewPriceHistory} />
      <WorthBuyingCard
        verdict={getWorthBuyingVerdict(product, analysis, priceTone, priceData?.stats.windowDays)}
        tags={getInsightTags(product, analysis)}
        product={product}
        averageRating={averageRating}
        onTagClick={scrollToHighlights}
      />
      <ProsConsCard
        pros={pros}
        cons={cons}
        loading={prosConsLoading}
        prosPageSelector={prosPageSelector}
        aiDisabled={!rufusEnabled}
        usingAiPros={usingAiPros}
        onEnableAi={onEnableRufus}
        onExpand={() => {
          // Only query Rufus once the user has consented; otherwise the
          // page-derived fallback pros/cons stay shown.
          if (rufusEnabled) void prosCons.load();
        }}
      />
      {product.seller ? (
        <SellerCard
          sellerName={product.seller.name}
          fulfilledByAmazon={product.seller.fulfilledByAmazon}
          state={seller.state}
          onLoad={() => void seller.load()}
          onRetry={() => void seller.load(true)}
          onOpenDetail={() => setSellerDetailOpen(true)}
        />
      ) : null}
      <div ref={ratingBreakdownRef}>
        <RatingBreakdownCard
          distribution={getRealRatingBreakdown(product)}
          highlights={getReviewHighlights(product)}
        />
      </div>

      {sellerDetailOpen && seller.state.status === "ready" ? (
        <SellerDetail info={seller.state.data} onClose={() => setSellerDetailOpen(false)} />
      ) : null}
    </div>
  );
}
