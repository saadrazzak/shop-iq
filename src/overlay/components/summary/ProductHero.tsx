import { Package } from "lucide-react";
import type { ProductData } from "../../../shared/types";
import { PriceBar } from "./PriceBar";

type ProductHeroProps = {
  product: ProductData;
  /** Switches the overlay to the Price History tab. */
  onViewPriceHistory?: () => void;
};

/** Product header: image, title, and price bar. */
export function ProductHero({ product, onViewPriceHistory }: ProductHeroProps) {
  return (
    <div
      data-testid="shopiq-product-hero"
      className="flex items-start gap-3 rounded-2xl bg-shopiq-hero p-3.5 text-shopiq-hero-foreground"
      style={{ boxShadow: "var(--shopiq-shadow-card)" }}
    >
      {product.imageUrl ? (
        <img
          alt=""
          className="h-14 w-14 flex-shrink-0 rounded-lg bg-shopiq-cream object-contain p-1"
          src={product.imageUrl}
        />
      ) : (
        <span className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-lg bg-shopiq-cream text-shopiq-hero">
          <Package className="h-6 w-6" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-snug">{product.title}</p>
        <PriceBar
          price={product.price}
          mrp={product.mrp}
          discountPercent={product.discountPercent}
          onViewPriceHistory={onViewPriceHistory}
        />
      </div>
    </div>
  );
}
