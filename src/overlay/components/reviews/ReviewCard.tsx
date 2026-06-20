import { Play } from "lucide-react";
import type { ProductReview } from "../../../shared/types";
import { Badge } from "../../atoms/Badge";
import { Card } from "../../atoms/Card";
import { StarRating } from "../../atoms/StarRating";
import { ratingToColor } from "../../lib/insights";
import { getReviewMedia } from "../../lib/reviewMedia";

type ReviewCardProps = {
  review: ProductReview;
  onReadMore: () => void;
  isActive?: boolean;
};

/** Max thumbnails shown inline on a card before the "+N" overflow tile. */
const MAX_THUMBS = 4;

/** Compact review card with a rating-coloured accent, clamped to a few lines. */
export function ReviewCard({ review, onReadMore, isActive = false }: ReviewCardProps) {
  const accentColor = typeof review.rating === "number" ? ratingToColor(review.rating) : undefined;
  const initial = review.author?.trim().charAt(0).toUpperCase() || "?";
  const media = getReviewMedia(review);
  const shown = media.slice(0, MAX_THUMBS);
  const overflow = media.length - shown.length;

  return (
    <Card data-testid="shopiq-review-card" className="relative flex gap-2 overflow-hidden p-3 pl-4">
      <span
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: accentColor ?? "var(--color-shopiq-border)" }}
      />
      <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-shopiq-slate text-xs font-medium text-shopiq-ink">
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-shopiq-ink">
            {review.author ?? "Amazon customer"}
            {review.verified ? <Badge tone="brand">Verified</Badge> : null}
          </p>
          {review.date ? <span className="shrink-0 text-[10px] text-shopiq-faint">{review.date}</span> : null}
        </div>
        {typeof review.rating === "number" ? (
          <div className="mt-0.5 mb-1.5">
            <StarRating rating={review.rating} size={11} color={accentColor} />
          </div>
        ) : null}
        <p className="line-clamp-3 text-xs leading-snug text-shopiq-body">{review.body}</p>

        {media.length > 0 ? (
          <button
            type="button"
            onClick={onReadMore}
            aria-label={`View ${media.length} photo${media.length === 1 ? "" : "s"} or video from this review`}
            className="mt-2 flex gap-1.5"
          >
            {shown.map((item, index) => (
              <span
                key={index}
                className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md border border-shopiq-border bg-shopiq-surface"
              >
                <img
                  src={item.kind === "video" ? item.thumbnail : item.url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                {item.kind === "video" ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                    <Play className="h-4 w-4 fill-white text-white" />
                  </span>
                ) : null}
                {index === shown.length - 1 && overflow > 0 ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-shopiq-brand-strong/70 text-xs font-medium text-white">
                    +{overflow}
                  </span>
                ) : null}
              </span>
            ))}
          </button>
        ) : null}

        <button
          type="button"
          onClick={onReadMore}
          className={`mt-1.5 block text-[11px] font-medium transition rounded px-1.5 py-0.5 ${
            isActive
              ? "bg-shopiq-brand text-white"
              : "text-shopiq-brand hover:text-shopiq-brand-strong"
          }`}
        >
          Read more
        </button>
      </div>
    </Card>
  );
}
