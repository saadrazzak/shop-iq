import { Star } from "lucide-react";
import { PALETTE } from "../lib/palette";

type StarRatingProps = {
  /** 0–5; rounded to the nearest whole star. */
  rating: number;
  size?: number;
  /** Star fill/outline colour. Defaults to the accent colour. */
  color?: string;
};

/** Row of five stars filled up to `rating`, in the given (or accent) colour. */
export function StarRating({ rating, size = 12, color = PALETTE.accent }: StarRatingProps) {
  const filled = Math.round(Math.max(0, Math.min(5, rating)));
  return (
    <span
      data-testid="shopiq-star-rating"
      className="inline-flex items-center gap-0.5"
      aria-label={`${rating} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          style={{ width: size, height: size }}
          fill={index < filled ? color : "transparent"}
          color={color}
        />
      ))}
    </span>
  );
}
