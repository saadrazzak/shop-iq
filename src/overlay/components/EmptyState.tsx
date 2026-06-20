import { PackageSearch } from "lucide-react";

/** Shown when no Amazon product has been detected on the page. */
export function EmptyState() {
  return (
    <div
      data-testid="shopiq-empty-state"
      className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-shopiq-cream-soft text-shopiq-brand">
        <PackageSearch className="h-6 w-6" />
      </span>
      <p className="text-sm font-medium text-shopiq-ink">No product detected</p>
      <p className="max-w-[220px] text-xs leading-relaxed text-shopiq-muted">
        Open an Amazon India product page and ShopIQ will pull together reviews, prices, and more.
      </p>
    </div>
  );
}
