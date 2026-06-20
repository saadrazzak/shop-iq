import { useEffect, useState } from "react";
import { Equal, TrendingDown, TrendingUp, X } from "lucide-react";
import type { PriceHistoryState } from "../../hooks/usePriceHistory";
import { getPriceAlert, type PriceAlertTone } from "../../lib/priceHistory";

/** How long the message pill stays expanded on first appearance before collapsing to just the dot. */
const AUTO_EXPAND_MS = 5000;

type PriceAlertBadgeProps = {
  state: PriceHistoryState;
  /** Opens (or switches to) the price history tab — opens the overlay first if it's collapsed to the launcher. */
  onOpen: () => void;
};

const TONE_ICON: Record<PriceAlertTone, typeof TrendingDown> = {
  low: TrendingDown,
  high: TrendingUp,
  same: Equal
};

const TONE_DOT_CLASSES: Record<PriceAlertTone, string> = {
  low: "bg-green-600",
  high: "bg-red-600",
  same: "bg-shopiq-slate"
};

const TONE_TEXT_CLASSES: Record<PriceAlertTone, string> = {
  low: "text-green-700",
  high: "text-red-700",
  same: "text-shopiq-body"
};

/**
 * Small notification dot pinned to the top-left corner of whichever ShopIQ UI
 * is currently showing (launcher button or overlay panel), once Amazon's AI
 * assistant has the product's 30-day price history (see `usePriceHistory`).
 * Hovering reveals a brief low/high/same price summary; clicking it opens (or
 * switches to) the price history tab.
 */
export function PriceAlertBadge({ state, onOpen }: PriceAlertBadgeProps) {
  const [dismissed, setDismissed] = useState(false);
  const [autoExpanded, setAutoExpanded] = useState(false);

  useEffect(() => {
    if (state.status !== "ready") return;

    setAutoExpanded(true);
    const timeoutId = window.setTimeout(() => setAutoExpanded(false), AUTO_EXPAND_MS);
    return () => window.clearTimeout(timeoutId);
  }, [state.status]);

  if (state.status !== "ready" || dismissed) return null;

  const alert = getPriceAlert(state.data.stats);
  const Icon = TONE_ICON[alert.tone];
  const expandedClasses = autoExpanded
    ? "mr-1.5 max-w-[240px] py-1.5 pl-2.5 pr-2 opacity-100"
    : "mr-0 max-w-0 py-1 pl-0 pr-0 opacity-0";

  return (
    <div
      data-testid="shopiq-price-alert-badge"
      className="shopiq-toast-in pointer-events-auto absolute -top-1.5 -left-1.5"
    >
      <div className="group relative">
        <button
          type="button"
          aria-label={alert.message}
          title={alert.message}
          onClick={onOpen}
          className={`relative z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-white ${TONE_DOT_CLASSES[alert.tone]}`}
          style={{ boxShadow: "var(--shopiq-shadow-card)" }}
        >
          <Icon className="h-3 w-3" />
        </button>
        <div
          className={`absolute top-0 right-full flex items-center gap-1.5 overflow-hidden rounded-full border border-shopiq-border bg-white text-[12px] font-medium whitespace-nowrap transition-all duration-200 group-hover:mr-1.5 group-hover:max-w-[240px] group-hover:py-1.5 group-hover:pl-2.5 group-hover:pr-2 group-hover:opacity-100 ${expandedClasses} ${TONE_TEXT_CLASSES[alert.tone]}`}
          style={{ boxShadow: "var(--shopiq-shadow-card)" }}
          onClick={onOpen}
        >
          <span>{alert.message}</span>
          <button
            type="button"
            aria-label="Dismiss"
            title="Dismiss"
            className="flex-shrink-0 rounded-full p-0.5 text-current opacity-60 transition hover:opacity-100"
            onClick={(event) => {
              event.stopPropagation();
              setDismissed(true);
            }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
