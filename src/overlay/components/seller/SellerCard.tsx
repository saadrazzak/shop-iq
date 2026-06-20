import { useEffect } from "react";
import { ChevronRight, RefreshCw, Star, Store } from "lucide-react";
import { CollapsibleCard } from "../../atoms/CollapsibleCard";
import { Spinner } from "../../atoms/Spinner";
import { ratingToColor } from "../../lib/insights";
import { headlinePeriod, positivePercent } from "../../lib/sellerRating";
import type { SellerRatingState } from "../../hooks/useSellerRating";

type SellerCardProps = {
  sellerName: string;
  fulfilledByAmazon?: boolean;
  state: SellerRatingState;
  /** Called once when the card first mounts, to lazily kick off the fetch. */
  onLoad: () => void;
  onRetry: () => void;
  onOpenDetail: () => void;
};

/** Collapsible seller scorecard for the Summary tab; opens the full detail overlay on click. */
export function SellerCard({
  sellerName,
  fulfilledByAmazon,
  state,
  onLoad,
  onRetry,
  onOpenDetail
}: SellerCardProps) {
  useEffect(() => {
    onLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const period = state.status === "ready" ? headlinePeriod(state.data) : undefined;

  const accessory =
    state.status === "loading" ? (
      <Spinner className="h-3.5 w-3.5 text-shopiq-faint" />
    ) : period?.average !== undefined ? (
      <span className="flex items-center gap-0.5 text-[14px] font-semibold text-shopiq-ink">
        {period.average.toFixed(1)}
        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      </span>
    ) : undefined;

  return (
    <CollapsibleCard
      testId="shopiq-seller-card"
      title="Seller"
      icon={<Store className="h-4 w-4" />}
      subtitle={sellerName}
      accessory={accessory}
    >
      {fulfilledByAmazon || period?.ratingCount ? (
        <div className="mb-2.5 flex items-center justify-between">
          {fulfilledByAmazon ? (
            <span className="inline-block rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
              Fulfilled by Amazon
            </span>
          ) : (
            <span />
          )}
          {period?.ratingCount ? (
            <span className="text-[10px] text-shopiq-faint">{compactCount(period.ratingCount)} ratings</span>
          ) : null}
        </div>
      ) : null}

      {state.status === "error" ? (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1 text-[11px] font-medium text-shopiq-brand hover:text-shopiq-brand-strong"
        >
          <RefreshCw className="h-3 w-3" />
          Couldn't load ratings — retry
        </button>
      ) : null}

      {period ? (
        <>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-shopiq-surface">
            {period.histogram
              .filter((bar) => bar.percent > 0)
              .map((bar) => (
                <div
                  key={bar.stars}
                  style={{ width: `${bar.percent}%`, backgroundColor: ratingToColor(bar.stars) }}
                  title={`${bar.stars}★ — ${bar.percent}%`}
                />
              ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[11px] text-shopiq-muted">
              <span className="font-medium text-green-700">{positivePercent(period)}% positive</span> (4–5★)
            </span>
            <button
              type="button"
              onClick={onOpenDetail}
              className="flex items-center gap-0.5 text-[11px] font-medium text-shopiq-brand hover:text-shopiq-brand-strong"
            >
              See seller feedback
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </>
      ) : null}
    </CollapsibleCard>
  );
}

/** 102720 → "103K", 8717 → "8.7K", 940 → "940". */
function compactCount(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
