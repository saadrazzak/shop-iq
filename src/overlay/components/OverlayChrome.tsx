import type { ReactNode } from "react";
import { Tabs, type TabItem } from "../atoms/Tabs";
import { OverlayHeader } from "./OverlayHeader";
import { OverlayFooter } from "./OverlayFooter";
import type { TabId } from "./tabs";

type BestDeal = {
  store: string;
  price: string;
  url?: string;
};

type OverlayChromeProps = {
  onClose: () => void;
  tabs: TabItem<TabId>[];
  activeTab: TabId;
  onTabChange: (id: TabId) => void;
  productName?: string;
  bestDeal?: BestDeal;
  children: ReactNode;
};

/** The overlay frame: header, tab bar, scrollable panel, and footer. */
export function OverlayChrome({
  onClose,
  tabs,
  activeTab,
  onTabChange,
  productName,
  bestDeal,
  children
}: OverlayChromeProps) {
  return (
    <div
      data-testid="shopiq-overlay-chrome"
      className="flex h-full w-[380px] flex-col overflow-hidden rounded-2xl border border-shopiq-border bg-shopiq-panel shadow-[0_12px_24px_rgba(20,38,57,0.18),0_40px_100px_rgba(20,38,57,0.4)]"
    >
      <OverlayHeader onClose={onClose} />
      <Tabs items={tabs} activeId={activeTab} onChange={onTabChange} />
      <div className="shopiq-no-scrollbar flex-1 overflow-y-auto bg-shopiq-surface">{children}</div>
      <OverlayFooter productName={productName} bestDeal={bestDeal} />
    </div>
  );
}
