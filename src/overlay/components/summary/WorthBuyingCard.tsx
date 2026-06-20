import { useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, Minus, ThumbsDown, ThumbsUp } from "lucide-react";
import type { ProductData } from "../../../shared/types";
import { Card } from "../../atoms/Card";
import { DonutChart } from "../../atoms/DonutChart";
import { Pill } from "../../atoms/Pill";
import { StarRating } from "../../atoms/StarRating";
import { PALETTE } from "../../lib/palette";
import { toneToColor, type SentimentTag, type Verdict } from "../../lib/insights";
import {
  activateAspectAndOverlay,
  deactivateAspectOverlay,
  scheduleHideReviewsOverlay,
  showReviewsOverlay
} from "../../lib/pageOverlay";

type WorthBuyingCardProps = {
  verdict: Verdict;
  tags: SentimentTag[];
  product: ProductData;
  averageRating?: number;
  /** Called when a tag without a matching page aspect is clicked — jumps to the "Top reviews & ratings" section. */
  onTagClick?: () => void;
};

/** Headline verdict: a score ring, a rating summary, a one-line call, and quick sentiment tags. */
export function WorthBuyingCard({ verdict, tags, product, averageRating, onTagClick }: WorthBuyingCardProps) {
  const accentColor = verdict.positive ? PALETTE.brand : PALETTE.accent;
  const [activeTag, setActiveTag] = useState<string | null>(null);

  return (
    <Card data-testid="shopiq-worth-buying-card" className="p-3">
      <div className="flex items-center gap-3">
        <div className="group relative">
          <DonutChart
            size={54}
            thickness={6}
            segments={[
              { value: verdict.score, color: accentColor },
              { value: 100 - verdict.score, color: PALETTE.cream }
            ]}
          >
            <span className="text-[15px] font-medium text-shopiq-ink">{verdict.score}</span>
          </DonutChart>
          <div
            className="pointer-events-none absolute top-full left-0 z-20 mt-2 w-56 rounded-xl border border-shopiq-border bg-white p-2.5 text-[11px] text-shopiq-body opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            style={{ boxShadow: "var(--shopiq-shadow-card)" }}
          >
            <p className="mb-1.5 font-medium text-shopiq-ink">How this score is calculated</p>
            <ul className="space-y-1">
              {verdict.scoreFactors.map((factor) => (
                <li key={factor.label} className="flex items-center justify-between gap-2">
                  <span>
                    {factor.label}{" "}
                    <span className="text-shopiq-faint">({Math.round(factor.weight * 100)}%)</span>
                  </span>
                  <span className="font-medium text-shopiq-ink">{factor.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[14px] font-medium text-shopiq-brand-strong">
            {verdict.positive ? (
              <CheckCircle2 className="h-4 w-4 text-shopiq-brand" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-shopiq-accent" />
            )}
            {verdict.label}
          </p>
          {averageRating !== undefined ? (
            <div
              className="mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-full px-1.5 py-0.5 text-[11px] text-shopiq-muted transition-colors hover:bg-shopiq-brand-soft"
              title="Hover to preview customer reviews"
              onMouseEnter={showReviewsOverlay}
              onMouseLeave={scheduleHideReviewsOverlay}
            >
              <StarRating rating={averageRating} />
              <span className="font-medium text-shopiq-ink">
                {averageRating.toFixed(1)}
                {product.reviewCount ? ` · ${product.reviewCount}` : null}
              </span>
              <Eye className="h-3 w-3 text-shopiq-brand" />
            </div>
          ) : null}
        </div>
      </div>
      {tags.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Pill
              key={tag.label}
              color={toneToColor(tag.tone)}
              icon={
                tag.tone === "positive" ? (
                  <ThumbsUp className="h-2.5 w-2.5 flex-shrink-0" />
                ) : tag.tone === "negative" ? (
                  <ThumbsDown className="h-2.5 w-2.5 flex-shrink-0" />
                ) : (
                  <Minus className="h-2.5 w-2.5 flex-shrink-0" />
                )
              }
              active={activeTag === tag.label}
              onClick={() => {
                if (activeTag === tag.label) {
                  setActiveTag(null);
                  if (tag.domAriaControls) deactivateAspectOverlay();
                  return;
                }

                setActiveTag(tag.label);
                if (tag.domAriaControls) {
                  activateAspectAndOverlay(tag.domAriaControls, toneToColor(tag.tone), () =>
                    setActiveTag(null)
                  );
                } else {
                  onTagClick?.();
                }
              }}
              title={
                tag.domAriaControls ? "View related reviews in an overlay" : "Jump to top reviews & ratings"
              }
            >
              {tag.label}
              {tag.mentions ? <span className="opacity-70">({tag.mentions})</span> : null}
            </Pill>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
