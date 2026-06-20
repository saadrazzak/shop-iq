import { LineChart, MessageCircle, Settings, Star, Zap } from "lucide-react";
import type { TabItem } from "../atoms/Tabs";

export type TabId = "summary" | "price-history" | "reviews" | "social" | "settings";

export type TabCounts = {
  rating?: string;
  social?: number;
};

const ICON_CLASS = "h-3 w-3 shrink-0";

/** Builds the tab bar items, injecting live badge counts where available. */
export function buildTabs(counts: TabCounts): TabItem<TabId>[] {
  return [
    { id: "summary", label: "Summary", icon: <Zap className={ICON_CLASS} /> },
    { id: "price-history", label: "History", icon: <LineChart className={ICON_CLASS} /> },
    { id: "reviews", label: "Reviews", icon: <Star className={ICON_CLASS} />, count: counts.rating },
    { id: "social", label: "Social", icon: <MessageCircle className={ICON_CLASS} />, count: counts.social },
    { id: "settings", icon: <Settings className={ICON_CLASS} /> }
  ];
}
