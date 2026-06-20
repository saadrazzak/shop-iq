import { useEffect, useState } from "react";
import { Star, Store, X } from "lucide-react";
import type { SellerInfo, SellerRatingPeriod } from "../../../shared/types";
import { SideOverlay } from "../../atoms/SideOverlay";
import { ratingToColor } from "../../lib/insights";
import { positivePercent } from "../../lib/sellerRating";

type SellerDetailProps = {
  info: SellerInfo;
  onClose: () => void;
};

/** Short period labels for the toggle chips. */
const SHORT_LABEL: Record<SellerRatingPeriod["period"], string> = {
  "30d": "1M",
  "90d": "3M",
  "365d": "1Y",
  lifetime: "All"
};

/** Full seller scorecard shown as a centered overlay beside/over the page (dismiss via × or Esc). */
export function SellerDetail({ info, onClose }: SellerDetailProps) {
  const defaultIndex = Math.max(
    0,
    info.periods.findIndex((p) => p.period === "365d")
  );
  const [activeIndex, setActiveIndex] = useState(defaultIndex);
  const period = info.periods[activeIndex] ?? info.periods[0];

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <SideOverlay onClose={onClose} testId="shopiq-seller-detail" ariaLabel="Seller feedback" width="min(480px, 92%)">
        <header className="flex items-center gap-2 border-b border-shopiq-border bg-shopiq-brand-strong px-3.5 py-2.5">
          <span className="text-[15px] font-medium text-white">Seller feedback</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-3.5">
          {/* Seller header */}
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-shopiq-brand-soft">
              <Store className="h-5 w-5 text-shopiq-brand" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium text-shopiq-ink">{info.name}</p>
              {info.fulfilledByAmazon ? (
                <span className="mt-0.5 inline-block rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                  Fulfilled by Amazon
                </span>
              ) : null}
            </div>
          </div>

          {/* Period toggle */}
          {info.periods.length > 1 ? (
            <div className="mb-3 flex gap-1.5">
              {info.periods.map((p, index) => (
                <button
                  key={p.period}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-center text-[11px] transition-colors ${
                    index === activeIndex
                      ? "bg-shopiq-brand-strong font-medium text-white"
                      : "bg-shopiq-surface text-shopiq-muted hover:text-shopiq-ink"
                  }`}
                >
                  <span className="block">{SHORT_LABEL[p.period]}</span>
                  {p.average !== undefined ? (
                    <span className="text-[10px] opacity-80">{p.average.toFixed(1)}★</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          {/* Score row */}
          <div className="mb-3 flex gap-2.5">
            <div className="flex-1 rounded-xl bg-shopiq-surface p-3 text-center">
              <span className="flex items-center justify-center gap-1 text-[22px] font-semibold leading-none text-shopiq-ink">
                {period.average !== undefined ? period.average.toFixed(1) : "—"}
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              </span>
              <p className="mt-1.5 text-[10px] text-shopiq-faint">
                {period.ratingCount ? `${period.ratingCount.toLocaleString("en-IN")} ratings` : "ratings"}
              </p>
            </div>
            <div className="flex-1 rounded-xl bg-shopiq-surface p-3 text-center">
              <span className="text-[22px] font-semibold leading-none text-green-700">
                {positivePercent(period)}%
              </span>
              <p className="mt-1.5 text-[10px] text-shopiq-faint">positive (4–5★)</p>
            </div>
          </div>

          {/* Histogram */}
          <div className="mb-4 flex flex-col gap-1.5">
            {period.histogram.map((bar) => (
              <div key={bar.stars} className="flex items-center gap-2">
                <span className="w-6 flex-shrink-0 text-[10px] text-shopiq-faint">{bar.stars}★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-shopiq-surface">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${bar.percent}%`, backgroundColor: ratingToColor(bar.stars) }}
                  />
                </div>
                <span className="w-9 flex-shrink-0 text-right text-[10px] text-shopiq-muted">{bar.percent}%</span>
              </div>
            ))}
          </div>

          {/* Recent feedback */}
          {info.feedback.length > 0 ? (
            <>
              <p className="mb-2 text-[12px] font-medium text-shopiq-brand-strong">Recent feedback</p>
              <div className="flex flex-col gap-2.5">
                {info.feedback.map((item, index) => {
                  const color = ratingToColor(item.stars);
                  return (
                    <div key={index} className="border-l-[3px] pl-2.5" style={{ borderLeftColor: color }}>
                      <div className="flex items-center gap-1.5">
                        <span className="flex items-center gap-0.5 text-[11px] font-medium" style={{ color }}>
                          {item.stars}
                          <Star className="h-2.5 w-2.5" style={{ fill: color, color }} />
                        </span>
                        <span className="text-[10px] text-shopiq-faint">
                          {[item.author, item.date].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                      {item.text ? (
                        <p className="mt-0.5 text-[11.5px] leading-snug text-shopiq-body">{item.text}</p>
                      ) : null}
                      {item.amazonResponsibility ? (
                        <span className="mt-1 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[9.5px] text-amber-700">
                          Amazon took responsibility for this order
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          <p className="mt-3 text-center text-[9.5px] text-shopiq-faint">
            Read from Amazon's seller profile · no page redirect
          </p>
        </div>
    </SideOverlay>
  );
}
