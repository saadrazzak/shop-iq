import { AlertCircle, Clock, X } from "lucide-react";
import { SideOverlay } from "../../atoms/SideOverlay";
import { Button } from "../../atoms/Button";
import { Spinner } from "../../atoms/Spinner";
import type { YearlyPriceHistoryState } from "../../hooks/useYearlyPriceHistory";
import {
  computePriceHistoryStats,
  getRangeCoverage,
  getYearlyCoverage,
  sliceForRange,
  type PriceHistoryRange,
  type PricePoint
} from "../../lib/priceHistory";
import { PriceHistoryChart } from "./PriceHistoryChart";
import { PriceHistoryStats } from "./PriceHistoryStats";
import { PriceHistoryLimitedNotice } from "./PriceHistoryLimitedNotice";

type PriceHistoryOverlayProps = {
  /** The full fetched daily series; this component slices it for "1m"/"3m" itself, so switching range here never re-fetches. */
  dailyPoints: PricePoint[];
  /** Separate, on-demand weekly history for the 1-year range. */
  yearlyState: YearlyPriceHistoryState;
  onLoadYearly: (forceRefresh?: boolean) => void;
  range: PriceHistoryRange;
  onRangeChange: (range: PriceHistoryRange) => void;
  onClose: () => void;
};

const RANGE_OPTIONS: { id: PriceHistoryRange; label: string }[] = [
  { id: "1m", label: "1M" },
  { id: "3m", label: "3M" },
  { id: "1y", label: "1Y" }
];

/** Larger, centered version of the price history chart for when the inline 180px chart isn't roomy enough to read exact values off. Mirrors ReviewDetail's floating-card pattern. */
export function PriceHistoryOverlay({
  dailyPoints,
  yearlyState,
  onLoadYearly,
  range,
  onRangeChange,
  onClose
}: PriceHistoryOverlayProps) {
  const points =
    range !== "1y" ? sliceForRange(dailyPoints, range) : yearlyState.status === "ready" ? yearlyState.data.points : [];
  const stats = points.length > 0 ? computePriceHistoryStats(points) : undefined;
  const coverage =
    range !== "1y"
      ? getRangeCoverage(dailyPoints.length, range)
      : yearlyState.status === "ready"
        ? getYearlyCoverage(yearlyState.data.points.length)
        : undefined;

  return (
    <SideOverlay
      onClose={onClose}
      testId="shopiq-price-history-overlay"
      ariaLabel="Price history"
      width="min(860px, 94%)"
    >
      <header className="flex items-center gap-2 border-b border-shopiq-border bg-shopiq-brand-strong px-3.5 py-2.5">
        <span className="text-[15px] font-medium text-white">Price history</span>

        <div className="ml-auto flex items-center gap-1 rounded-md bg-white/15 p-0.5">
          {RANGE_OPTIONS.map((option) => {
            const active = option.id === range;
            return (
              <button
                key={option.id}
                type="button"
                data-testid={`shopiq-price-history-overlay-range-${option.id}`}
                onClick={() => onRangeChange(option.id)}
                className={`rounded-[5px] px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  active ? "bg-shopiq-brand text-white" : "text-white/80 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {coverage?.isLimited ? <PriceHistoryLimitedNotice coverage={coverage} /> : null}

        {range === "1y" && yearlyState.status === "idle" ? (
          <div
            data-testid="shopiq-price-history-overlay-load-yearly"
            className="flex flex-col items-center gap-2 py-10 text-center"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-shopiq-brand-soft">
              <Clock className="h-4 w-4 text-shopiq-brand" />
            </div>
            <p className="text-[13px] font-medium text-shopiq-brand-strong">Get a full year of prices</p>
            <p className="max-w-[280px] text-[11px] leading-relaxed text-shopiq-muted">
              This asks Amazon's AI assistant for each week's lowest price over the last year - loaded
              only when you ask for it.
            </p>
            <Button className="mt-1" onClick={() => onLoadYearly()} icon={<Clock className="h-3.5 w-3.5" />}>
              Load 1-year history
            </Button>
          </div>
        ) : null}

        {range === "1y" && yearlyState.status === "loading" ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-xs text-shopiq-muted">
            <Spinner className="h-5 w-5" />
            <p>Asking Amazon's AI assistant for weekly prices…</p>
          </div>
        ) : null}

        {range === "1y" && yearlyState.status === "error" ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-xs text-shopiq-muted">
            <AlertCircle className="h-5 w-5 text-shopiq-accent" />
            <p>{yearlyState.error}</p>
            <Button variant="secondary" onClick={() => onLoadYearly(true)}>
              Try again
            </Button>
          </div>
        ) : null}

        {stats ? (
          <>
            {range === "1y" ? (
              <p className="mb-2 text-[11px] text-shopiq-faint">
                Shows each week's lowest price, not a single daily snapshot.
              </p>
            ) : null}
            <PriceHistoryChart points={points} height={420} />
            <PriceHistoryStats stats={stats} />
          </>
        ) : null}
      </div>
    </SideOverlay>
  );
}
