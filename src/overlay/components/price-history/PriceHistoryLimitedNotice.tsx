import { Info } from "lucide-react";
import type { PriceHistoryCoverage } from "../../lib/priceHistory";

/** Limited-history banner, shared by the inline tab and the expanded overlay, for both the 45d/6m daily view and the 1-year weekly view. */
export function PriceHistoryLimitedNotice({ coverage }: { coverage: PriceHistoryCoverage }) {
  return (
    <div
      data-testid="shopiq-price-history-limited"
      className="mb-2 flex items-start gap-2 rounded-xl border border-shopiq-accent/30 bg-shopiq-accent/10 p-2 text-[11px] text-shopiq-ink"
    >
      <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-shopiq-accent" />
      <p>
        Only {coverage.availableCount} {coverage.unit}
        {coverage.availableCount === 1 ? "" : "s"} of price history found — this product may be newly
        listed. Showing what's available instead of the full {coverage.targetLabel}.
      </p>
    </div>
  );
}
