import { AlertTriangle, Equal, Sparkles, Tag, TrendingDown, TrendingUp } from "lucide-react";
import {
  getPriceAlert,
  type PriceAlert,
  type PriceAlertTone,
  type PriceHistoryStats as Stats
} from "../../lib/priceHistory";
import { formatRupees } from "../../../shared/utils/format";

type PriceHistoryStatsProps = {
  stats: Stats;
};

const LOW_CLASSES = "border-green-200 bg-green-50 text-green-700";
const HIGH_CLASSES = "border-red-200 bg-red-50 text-red-700";
const MID_CLASSES = "border-gray-200 bg-gray-50 text-gray-600";

const TONE_CLASSES: Record<PriceAlertTone, string> = {
  low: LOW_CLASSES,
  high: HIGH_CLASSES,
  same: MID_CLASSES
};

const ITEMS: { key: keyof Pick<Stats, "lowest" | "highest" | "current">; label: string; icon: typeof Tag }[] =
  [
    { key: "lowest", label: "Lowest", icon: TrendingDown },
    { key: "highest", label: "Highest", icon: TrendingUp },
    { key: "current", label: "Current", icon: Tag }
  ];

const CARD_CLASSES: Record<string, string> = {
  lowest: LOW_CLASSES,
  highest: HIGH_CLASSES
};

type Insight = { icon: typeof Sparkles; className: string; message: string; detail?: string };

const INSIGHT_ICONS: Record<PriceAlertTone, typeof Sparkles> = {
  low: TrendingDown,
  high: AlertTriangle,
  same: Equal
};

/** A one-line takeaway comparing the current price to its 30-day range, so the tab isn't just a chart + numbers. */
function getInsight(stats: Stats, alert: PriceAlert): Insight {
  if (stats.current.price <= stats.lowest.price) {
    return { icon: Sparkles, className: LOW_CLASSES, message: alert.message, detail: alert.detail };
  }

  return {
    icon: INSIGHT_ICONS[alert.tone],
    className: TONE_CLASSES[alert.tone],
    message: alert.message,
    detail: alert.detail
  };
}

/** Lowest / highest / current price summary cards, plus a one-line takeaway on whether now is a good time to buy. */
export function PriceHistoryStats({ stats }: PriceHistoryStatsProps) {
  const alert = getPriceAlert(stats);
  const insight = getInsight(stats, alert);
  const InsightIcon = insight.icon;

  return (
    <div data-testid="shopiq-price-history-stats">
      <div className="mt-3 grid grid-cols-3 gap-2">
        {ITEMS.map(({ key, label, icon: Icon }) => {
          const point = stats[key];
          const className = key === "current" ? TONE_CLASSES[alert.tone] : CARD_CLASSES[key];
          return (
            <div
              key={key}
              className={`flex flex-col items-center gap-0.5 rounded-xl border p-2 text-center ${className}`}
            >
              <span className="flex items-center gap-1 text-[10px] font-medium opacity-80">
                <Icon className="h-3 w-3" />
                {label}
              </span>
              <span className="text-[13px] font-semibold">{formatRupees(point.price)}</span>
              <span className="text-[10px] opacity-70">{point.label}</span>
            </div>
          );
        })}
      </div>

      <div
        data-testid="shopiq-price-history-insight"
        className={`mt-2 flex items-start gap-2 rounded-xl border p-2 text-[11px] ${insight.className}`}
      >
        <InsightIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        <div>
          <p>{insight.message}</p>
          {insight.detail && <p className="mt-0.5 opacity-70">{insight.detail}</p>}
        </div>
      </div>
    </div>
  );
}
