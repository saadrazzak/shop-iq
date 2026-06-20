import { MessageSquare } from "lucide-react";
import type { ProductReview } from "../../../shared/types";
import { ReviewCard } from "./ReviewCard";

type ReviewsListProps = {
  reviews: ProductReview[];
  onSelect: (review: ProductReview) => void;
  activeReview?: ProductReview | null;
  title?: string;
};

/** List of review cards, best/worst analysis highlights first. */
function reviewKey(r: ProductReview): string {
  return r.domId ?? r.body;
}

export function ReviewsList({ reviews, onSelect, activeReview, title = "Reviews" }: ReviewsListProps) {
  const activeKey = activeReview ? reviewKey(activeReview) : null;
  if (reviews.length === 0) return null;

  return (
    <section data-testid="shopiq-reviews-list">
      <p className="mb-1.5 flex items-center gap-1.5 text-[14px] font-medium text-shopiq-brand-strong">
        <MessageSquare className="h-3.5 w-3.5" />
        {title}
        <span className="text-[11px] font-normal text-shopiq-faint">({reviews.length})</span>
      </p>
      <div className="flex flex-col gap-2">
        {reviews.map((review, index) => (
          <ReviewCard
            key={review.domId ?? index}
            review={review}
            onReadMore={() => onSelect(review)}
            isActive={activeKey !== null && reviewKey(review) === activeKey}
          />
        ))}
      </div>
    </section>
  );
}
