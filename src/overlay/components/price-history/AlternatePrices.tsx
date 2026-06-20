import { AlertCircle, ExternalLink, Layers, RefreshCw, Store } from "lucide-react";
import { Card } from "../../atoms/Card";
import { Button } from "../../atoms/Button";
import { Spinner } from "../../atoms/Spinner";
import type { PriceConfidence, RetailerPrice } from "../../../shared/types";
import type { PricesState } from "../../hooks/usePrices";
import { formatRupees } from "../../../shared/utils/format";

type AlternatePricesProps = {
  state: PricesState;
  /** The current product's price (from Amazon), used to compute savings. */
  currentPrice?: number;
  onRefresh: (forceRefresh?: boolean) => void;
};

const CONFIDENCE_DOT: Record<PriceConfidence, string> = {
  high: "bg-green-500",
  medium: "bg-amber-400",
  low: "bg-gray-300"
};

const CONFIDENCE_LABEL: Record<PriceConfidence, string> = {
  high: "Strong match",
  medium: "Likely match",
  low: "Possible match"
};

const CONFIDENCE_COLOR: Record<PriceConfidence, string> = {
  high: "text-green-600",
  medium: "text-amber-600",
  low: "text-shopiq-faint"
};

/** A single retailer row: store name, match label + matched title, price, and savings. */
function PriceRow({ price, currentPrice }: { price: RetailerPrice; currentPrice?: number }) {
  const diff = typeof currentPrice === "number" ? currentPrice - price.price : undefined;

  return (
    <a
      data-testid={`shopiq-alt-price-${price.source.toLowerCase().replace(/\s+/g, "-")}`}
      className="flex items-center gap-2 border-t border-shopiq-border px-3 py-2.5 first:border-t-0 hover:bg-shopiq-surface"
      href={price.productUrl}
      rel="noreferrer"
      target="_blank"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-shopiq-ink">
          {price.source}
          <ExternalLink className="h-3 w-3 flex-shrink-0 text-shopiq-faint" />
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[10px]">
          <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${CONFIDENCE_DOT[price.confidence]}`} />
          <span className={`font-medium ${CONFIDENCE_COLOR[price.confidence]}`}>
            {CONFIDENCE_LABEL[price.confidence]}
          </span>
        </span>
        {price.title ? (
          <span className="mt-0.5 block truncate pl-3 text-[10px] text-shopiq-faint">{price.title}</span>
        ) : null}
      </span>

      <span className="flex flex-shrink-0 flex-col items-end">
        <span className="text-[13px] font-semibold text-shopiq-ink">{formatRupees(price.price)}</span>
        {typeof diff === "number" && diff !== 0 ? (
          <span className={`text-[10px] font-medium ${diff > 0 ? "text-green-600" : "text-red-500"}`}>
            {diff > 0 ? `Save ${formatRupees(diff)}` : `${formatRupees(-diff)} more`}
          </span>
        ) : null}
      </span>
    </a>
  );
}

function PriceList({ prices, currentPrice }: { prices: RetailerPrice[]; currentPrice?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-shopiq-border">
      {prices.map((price) => (
        <PriceRow key={`${price.source}-${price.productUrl}`} price={price} currentPrice={currentPrice} />
      ))}
    </div>
  );
}

/** Live prices for the same product on other retailers, shown below the price chart. */
export function AlternatePrices({ state, currentPrice, onRefresh }: AlternatePricesProps) {
  const prices = state.comparison?.prices ?? [];
  const exact = prices.filter((p) => p.match === "exact");
  const variants = prices.filter((p) => p.match === "variant");
  const hasResults = prices.length > 0;
  const pricesLoaded = !state.loading && !state.error;

  return (
    <Card className="p-3" data-testid="shopiq-alternate-prices">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[14px] font-medium text-shopiq-brand-strong">
          <Store className="h-3.5 w-3.5" />
          Prices on other sites
        </p>
        {!state.loading ? (
          <button
            data-testid="shopiq-alternate-prices-refresh"
            type="button"
            title="Refresh prices"
            onClick={() => onRefresh(true)}
            className="text-shopiq-faint transition-colors hover:text-shopiq-brand"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {state.loading ? (
        <div
          data-testid="shopiq-alternate-prices-loading"
          className="flex flex-col items-center gap-2 py-6 text-center text-xs text-shopiq-muted"
        >
          <Spinner className="h-5 w-5" />
          <p>Checking other stores for live prices…</p>
        </div>
      ) : state.error ? (
        <div
          data-testid="shopiq-alternate-prices-error"
          className="flex flex-col items-center gap-2 py-5 text-center text-xs text-shopiq-muted"
        >
          <AlertCircle className="h-5 w-5 text-shopiq-accent" />
          <p>{state.error}</p>
          <Button variant="secondary" onClick={() => onRefresh(true)}>
            Try again
          </Button>
        </div>
      ) : hasResults ? (
        <div className="flex flex-col gap-3">
          {exact.length > 0 ? <PriceList prices={exact} currentPrice={currentPrice} /> : null}

          {variants.length > 0 ? (
            <div data-testid="shopiq-alternate-prices-variants" className="flex flex-col gap-1.5">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-shopiq-muted">
                <Layers className="h-3 w-3" />
                Similar items — different variant
              </p>
              <PriceList prices={variants} currentPrice={currentPrice} />
            </div>
          ) : null}
        </div>
      ) : pricesLoaded ? (
        <p data-testid="shopiq-alternate-prices-empty" className="py-4 text-center text-xs text-shopiq-muted">
          No matching listings found on other stores.
        </p>
      ) : null}
    </Card>
  );
}
