import type { ReactNode } from "react";

/**
 * Width reserved on the right for the ShopIQ panel (`w-[380px]` at `right-4`)
 * plus a small gap, so the dim area and the centered card stay clear of it.
 */
const PANEL_RESERVE = "404px";

type SideOverlayProps = {
  onClose: () => void;
  /** Card width — centered within the page area left of the ShopIQ panel (use a `min(px, %)`). */
  width: string;
  ariaLabel: string;
  testId?: string;
  children: ReactNode;
};

/**
 * A dimmed overlay that fills only the page area to the LEFT of the ShopIQ panel
 * (so the panel stays lit and uncovered) and centers a card within it — matching
 * the on-page "peek" overlays. Clicking the dim area closes it.
 */
export function SideOverlay({ onClose, width, ariaLabel, testId, children }: SideOverlayProps) {
  return (
    <div
      onClick={onClose}
      className="pointer-events-auto fixed inset-y-0 left-0 z-[2147483646] flex items-center justify-center bg-shopiq-ink/55 backdrop-blur-[1px]"
      style={{ right: PANEL_RESERVE }}
    >
      <div
        data-testid={testId}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="pointer-events-auto flex max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-shopiq-border bg-shopiq-panel shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
        style={{ width, position: "absolute", left: "20%" }}
      >
        {children}
      </div>
    </div>
  );
}
