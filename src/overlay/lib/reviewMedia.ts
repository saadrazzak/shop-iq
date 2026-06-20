import type { ProductReview } from "../../shared/types";

export type ReviewMediaItem =
  | { kind: "image"; url: string }
  | { kind: "video"; thumbnail?: string; videoUrl?: string; link?: string };

/** Amazon review permalink (where the customer video actually plays), built from the review id. */
function reviewPermalink(review: ProductReview): string | undefined {
  return review.domId ? `https://www.amazon.in/gp/customer-reviews/${review.domId}` : undefined;
}

/** Combined, ordered media for a review: customer video first (if any), then photos. */
export function getReviewMedia(review: ProductReview): ReviewMediaItem[] {
  const media: ReviewMediaItem[] = [];
  if (review.videoThumbnail || review.videoUrl) {
    media.push({
      kind: "video",
      thumbnail: review.videoThumbnail,
      videoUrl: review.videoUrl,
      link: reviewPermalink(review)
    });
  }
  for (const url of review.images ?? []) {
    media.push({ kind: "image", url });
  }
  return media;
}
