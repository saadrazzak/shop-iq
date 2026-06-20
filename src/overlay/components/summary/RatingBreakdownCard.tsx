import { useState } from "react";
import { Link2, Star } from "lucide-react";
import { Card } from "../../atoms/Card";
import type { RatedHighlight, RatingSegment } from "../../lib/insights";
import {
  activateReviewOverlay,
  deactivateReviewOverlay,
} from "../../lib/pageOverlay";

type RatingBreakdownCardProps = {
  distribution: RatingSegment[];
  highlights: RatedHighlight[];
};

/** Pills shorter than this read as fragments rather than highlights, so they're skipped. */
const MIN_HIGHLIGHT_WORDS = 2;

function wordCount(label: string): number {
  return label.trim().split(/\s+/).filter(Boolean).length;
}

/** A stacked bar of the real star distribution, followed by review-title highlights with a per-review star badge. */
export function RatingBreakdownCard({ distribution, highlights }: RatingBreakdownCardProps) {
  // The single highlight whose source review is currently floated as an overlay
  // on the live page. Tracks the review's element id so we can revert it.
  const [active, setActive] = useState<{ label: string; domId: string } | null>(null);

  function toggleHighlight(label: string, domId: string, color: string): void {
    if (active?.label === label) {
      deactivateReviewOverlay(domId);
      setActive(null);
      return;
    }

    // Switching to another highlight: revert the previously floated review first
    // so only one review is ever lifted out of the page at a time.
    if (active) deactivateReviewOverlay(active.domId);
    activateReviewOverlay(domId, color, () => setActive(null));
    setActive({ label, domId });
  }

  const visibleHighlights = highlights.filter(
    (highlight) => wordCount(highlight.label) >= MIN_HIGHLIGHT_WORDS
  );

  return (
    <Card data-testid="shopiq-rating-breakdown-card" className="p-3">
      <p className="mb-2 text-[14px] font-medium text-shopiq-brand-strong">Top reviews</p>
      {distribution.length > 0 ? (
        <div
          className="mb-2.5 flex h-1.5 w-full overflow-hidden rounded-full bg-shopiq-cream-soft"
        >
          {distribution
            .filter((segment) => segment.percent > 0)
            .map((segment) => (
              <div
                key={segment.label}
                className="h-full"
                style={{ width: `${segment.percent}%`, backgroundColor: segment.color }}
                title={`${segment.label}: ${segment.percent}%`}
              />
            ))}
        </div>
      ) : null}
      <div className="flex flex-col gap-0.5">
        {visibleHighlights.map((highlight, index) => {
          const isActive = highlight.pageElementId ? active?.label === highlight.label : false;
          const Tag = highlight.pageElementId ? "button" : "div";

          return (
            <Tag
              key={highlight.label}
              type={highlight.pageElementId ? "button" : undefined}
              onClick={
                highlight.pageElementId
                  ? () => toggleHighlight(highlight.label, highlight.pageElementId!, highlight.color)
                  : undefined
              }
              title={highlight.pageElementId ? "View this review in an overlay" : undefined}
              className={`flex w-full items-start gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors ${
                highlight.pageElementId && !isActive ? "cursor-pointer hover:bg-shopiq-cream-soft" : ""
              } ${index < visibleHighlights.length - 1 ? "border-b border-shopiq-border/60" : ""}`}
              style={isActive ? { backgroundColor: `${highlight.color}26` } : undefined}
            >
              <span
                className="mt-0.5 flex flex-shrink-0 items-center gap-0.5 rounded-md px-1 py-0.5 text-[10px] font-medium leading-none"
                style={{ color: highlight.color, backgroundColor: `${highlight.color}1a` }}
              >
                <Star className="h-2.5 w-2.5" fill={highlight.color} color={highlight.color} />
                {highlight.rating}
              </span>
              <span className="min-w-0 flex-1 text-[12px] leading-snug text-shopiq-ink [overflow-wrap:anywhere] line-clamp-2">
                {highlight.label}
              </span>
              {highlight.pageElementId ? (
                <Link2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-shopiq-slate" />
              ) : null}
            </Tag>
          );
        })}
      </div>
    </Card>
  );
}
