import { Link2 } from "lucide-react";

type PriceBarProps = {
  price?: string;
  /** Struck-through "M.R.P." price, e.g. "₹49,999". */
  mrp?: string;
  /** Savings percentage, e.g. "-5%". */
  discountPercent?: string;
  /** Switches the overlay to the Price History tab. */
  onViewPriceHistory?: () => void;
};

/** Price pill shown inside the hero, below the product title. Shows the real MRP/discount when Amazon provides them, plus a link to the Price History tab. */
export function PriceBar({ price, mrp, discountPercent, onViewPriceHistory }: PriceBarProps) {
  if (!price) return null;

  return (
    <div
      data-testid="shopiq-price-bar"
      className="mt-2 flex items-center gap-2 rounded-xl bg-shopiq-panel px-2.5 py-2"
    >
      <span className="text-sm font-semibold text-shopiq-brand-strong">{price}</span>
      {mrp ? (
        <span className="flex flex-col items-start gap-0.5">
          {discountPercent ? (
            <span className="rounded-full bg-shopiq-accent px-1.5 py-px text-[8px] font-semibold leading-tight text-white">
              {discountPercent}
            </span>
          ) : null}
          <span className="text-[10px] text-shopiq-faint line-through">{mrp}</span>
        </span>
      ) : discountPercent ? (
        <span className="text-[10px] font-medium text-shopiq-accent">{discountPercent}</span>
      ) : null}
      {onViewPriceHistory ? (
        <button
          data-testid="shopiq-price-history-button"
          type="button"
          onClick={onViewPriceHistory}
          className="ml-auto flex items-center gap-1 rounded-full border border-shopiq-brand-border bg-shopiq-brand-soft px-2 py-1 text-[11px] font-semibold text-shopiq-brand-strong transition-colors hover:bg-shopiq-brand-soft/80"
        >
          &#8377; History <Link2 className="h-3 w-3 flex-shrink-0" />
        </button>
      ) : null}
    </div>
  );
}
