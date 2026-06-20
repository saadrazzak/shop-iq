import { ChevronRight } from "lucide-react";

type BestDeal = {
  store: string;
  price: string;
  url?: string;
};

type OverlayFooterProps = {
  productName?: string;
  bestDeal?: BestDeal;
};

/** Persistent footer: product name on the left, best deal link on the right. */
export function OverlayFooter({ productName, bestDeal }: OverlayFooterProps) {
  if (!productName && !bestDeal) return null;

  return (
    <footer
      data-testid="shopiq-overlay-footer"
      className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-shopiq-border bg-shopiq-panel px-3.5 py-2.5"
    >
      <span className="min-w-0 flex-1 truncate text-xs text-shopiq-body">{productName}</span>
      {bestDeal ? (
        <a
          className="flex flex-shrink-0 items-center gap-1 text-xs font-medium text-shopiq-accent hover:underline"
          href={bestDeal.url}
          rel="noreferrer"
          target="_blank"
        >
          Best deal: {bestDeal.store} {bestDeal.price}
          <ChevronRight className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </footer>
  );
}
