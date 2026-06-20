import { AlertCircle, ExternalLink, LineChart, Lock, RefreshCw, Sparkles } from "lucide-react";
import { Card } from "../../atoms/Card";
import { Button } from "../../atoms/Button";
import { Spinner } from "../../atoms/Spinner";
import type { PriceHistoryState } from "../../hooks/usePriceHistory";
import type { PricesState } from "../../hooks/usePrices";
import { PriceHistoryChart } from "./PriceHistoryChart";
import { PriceHistoryStats } from "./PriceHistoryStats";
import { AlternatePrices } from "./AlternatePrices";

type PriceHistoryTabProps = {
  state: PriceHistoryState;
  onRefresh: (forceRefresh?: boolean) => void;
  /** Live prices from other retailers, shown below the chart. */
  prices: PricesState;
  /** Current product price (numeric) for computing savings vs. other stores. */
  currentPrice?: number;
  onRefreshPrices: (forceRefresh?: boolean) => void;
  /** Grants consent to query Amazon's AI assistant (shown when price history is gated off). */
  onEnableRufus: () => void;
  /** Amazon ASIN, used to build a Keepa deep-link fallback when price history is unavailable. */
  asin?: string;
};

/** Daily price history sourced from Amazon's on-page AI assistant, rendered as a line chart, with live prices from other retailers below it. Loading happens in the background (see `usePriceHistory`/`usePrices` in App); this tab only displays the result. */
export function PriceHistoryTab({
  state,
  onRefresh,
  prices,
  currentPrice,
  onRefreshPrices,
  onEnableRufus,
  asin
}: PriceHistoryTabProps) {
  const keepaUrl = asin ? `https://keepa.com/#!product/10-${asin}` : undefined;
  return (
    <div data-testid="shopiq-price-history-tab" className="flex flex-col gap-2.5 p-3.5">
      <Card className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[14px] font-medium text-shopiq-brand-strong">
            <LineChart className="h-3.5 w-3.5" />
            Price history (last 30 days)
          </p>
          {state.status === "ready" ? (
            <button
              data-testid="shopiq-price-history-refresh"
              type="button"
              title="Refresh price history"
              onClick={() => onRefresh(true)}
              className="text-shopiq-faint transition-colors hover:text-shopiq-brand"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {state.status === "disabled" ? (
          <div
            data-testid="shopiq-price-history-consent"
            className="flex flex-col items-center gap-2 py-6 text-center"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-shopiq-brand-soft">
              <Sparkles className="h-4 w-4 text-shopiq-brand" />
            </div>
            <p className="text-[13px] font-medium text-shopiq-brand-strong">Powered by Amazon's AI</p>
            <p className="max-w-[260px] text-[10.5px] leading-relaxed text-shopiq-muted">
              ShopIQ asks Amazon's on-page assistant (Rufus) for the last 30 days of prices. This sends a
              prompt on your behalf — turn it on to see price history.
            </p>
            <Button className="mt-1" onClick={onEnableRufus} icon={<Sparkles className="h-3.5 w-3.5" />}>
              Enable Amazon AI
            </Button>
          </div>
        ) : null}

        {state.status === "idle" || state.status === "loading" ? (
          <div
            data-testid="shopiq-price-history-loading"
            className="flex flex-col items-center gap-2 py-8 text-center text-xs text-shopiq-muted"
          >
            <Spinner className="h-5 w-5" />
            <p>Asking Amazon's AI assistant for price history…</p>
            <p className="text-shopiq-faint">This can take up to a minute.</p>
          </div>
        ) : null}

        {state.status === "error" ? (
          state.error.startsWith("Sign in") ? (
            <div
              data-testid="shopiq-price-history-error"
              className="flex flex-col items-center py-5 text-center"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-shopiq-surface">
                <Lock className="h-4 w-4 text-shopiq-brand" />
              </div>
              <p className="text-[12px] font-medium text-shopiq-ink">{state.error}</p>
              <p className="mt-1 text-[10px] text-shopiq-muted">We pull price data from Amazon's AI.</p>
              {keepaUrl ? (
                <>
                  <div className="my-3 flex w-full items-center gap-2 text-[9px] text-shopiq-faint">
                    <div className="h-px flex-1 bg-shopiq-border" />
                    or
                    <div className="h-px flex-1 bg-shopiq-border" />
                  </div>
                  <a
                    href={keepaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-shopiq-border bg-shopiq-surface px-3 py-2 text-[11px] font-medium text-shopiq-muted transition-colors hover:text-shopiq-ink"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View price history on Keepa
                  </a>
                </>
              ) : null}
            </div>
          ) : (
            <div
              data-testid="shopiq-price-history-error"
              className="flex flex-col items-center gap-2 py-6 text-center text-xs text-shopiq-muted"
            >
              <AlertCircle className="h-5 w-5 text-shopiq-accent" />
              <p>{state.error}</p>
              <Button variant="secondary" onClick={() => onRefresh(true)}>
                Try again
              </Button>
              {keepaUrl ? (
                <>
                  <div className="flex w-full items-center gap-2 text-[9px] text-shopiq-faint">
                    <div className="h-px flex-1 bg-shopiq-border" />
                    or
                    <div className="h-px flex-1 bg-shopiq-border" />
                  </div>
                  <a
                    href={keepaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[10px] text-shopiq-muted transition-colors hover:text-shopiq-brand"
                  >
                    View price history on Keepa
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </>
              ) : null}
            </div>
          )
        ) : null}

        {state.status === "ready" ? (
          <>
            <PriceHistoryChart points={state.data.points} />
            <PriceHistoryStats stats={state.data.stats} />
          </>
        ) : null}
      </Card>

      <AlternatePrices state={prices} currentPrice={currentPrice} onRefresh={onRefreshPrices} />
    </div>
  );
}
