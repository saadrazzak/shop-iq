import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Play, X } from "lucide-react";
import type { ProductReview } from "../../../shared/types";
import { Badge } from "../../atoms/Badge";
import { SideOverlay } from "../../atoms/SideOverlay";
import { StarRating } from "../../atoms/StarRating";
import { ratingToColor } from "../../lib/insights";
import { getReviewMedia } from "../../lib/reviewMedia";

type ReviewDetailProps = {
  review: ProductReview;
  onClose: () => void;
};

/** Max small thumbnails shown beneath the hero before the "+N" overflow tile. */
const MAX_THUMB_ROW = 3;

/**
 * Large review detail shown as a floating card centered beside the ShopIQ panel
 * (the panel is 380px at right:16px, so this sits to its left). Photos/video
 * open in an inline lightbox; dismissed via the × button or Esc.
 */
export function ReviewDetail({ review, onClose }: ReviewDetailProps) {
  const accentColor = typeof review.rating === "number" ? ratingToColor(review.rating) : undefined;
  const media = getReviewMedia(review);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const inLightbox = lightbox !== null;
  const count = media.length;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (inLightbox) setLightbox(null);
        else onClose();
        return;
      }
      if (!inLightbox || count === 0) return;
      if (event.key === "ArrowRight") setLightbox((index) => ((index ?? 0) + 1) % count);
      if (event.key === "ArrowLeft") setLightbox((index) => ((index ?? 0) - 1 + count) % count);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inLightbox, count, onClose]);

  const current = inLightbox ? media[lightbox] : undefined;

  const hasMedia = media.length > 0;
  const thumbs = media.slice(1);
  const shownThumbs = thumbs.slice(0, MAX_THUMB_ROW);
  const thumbOverflow = thumbs.length - shownThumbs.length;

  return (
    <SideOverlay
      onClose={onClose}
      testId="shopiq-review-detail"
      ariaLabel="Review detail"
      width={hasMedia ? "min(780px, 92%)" : "min(540px, 92%)"}
    >
      <header className="flex items-center gap-2 border-b border-shopiq-border bg-shopiq-brand-strong px-3.5 py-2.5">
        {inLightbox ? (
          <>
            <button
              type="button"
              onClick={() => setLightbox(null)}
              aria-label="Back to review"
              className="flex h-6 w-6 items-center justify-center rounded-md bg-white/15 text-white hover:bg-white/25"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-[14px] font-medium text-white">
              {current?.kind === "video" ? "Video" : "Photo"} {lightbox! + 1} of {count}
            </span>
          </>
        ) : (
          <span className="text-[15px] font-medium text-white">Review detail</span>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      {inLightbox ? (
        <LightboxView
          review={review}
          media={media}
          index={lightbox!}
          accentColor={accentColor}
          onSelect={setLightbox}
        />
      ) : (
        <div className="flex flex-1 items-start gap-4 overflow-y-auto p-4">
          {hasMedia ? (
            <div className="w-[240px] flex-shrink-0">
              <p className="mb-2 text-[11px] text-shopiq-faint">{describeMedia(review)}</p>
              <button
                type="button"
                onClick={() => setLightbox(0)}
                className="relative block h-[150px] w-full overflow-hidden rounded-lg border border-shopiq-border bg-shopiq-surface"
              >
                <img
                  src={media[0].kind === "video" ? media[0].thumbnail : media[0].url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                {media[0].kind === "video" ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90">
                      <Play className="ml-0.5 h-4 w-4 fill-shopiq-brand-strong text-shopiq-brand-strong" />
                    </span>
                  </span>
                ) : null}
              </button>
              {shownThumbs.length > 0 ? (
                <div className="mt-2 flex gap-2">
                  {shownThumbs.map((item, index) => {
                    const mediaIndex = index + 1;
                    const isLast = index === shownThumbs.length - 1;
                    return (
                      <button
                        key={mediaIndex}
                        type="button"
                        onClick={() => setLightbox(mediaIndex)}
                        className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-md border border-shopiq-border bg-shopiq-surface"
                      >
                        <img
                          src={item.kind === "video" ? item.thumbnail : item.url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                        {item.kind === "video" ? (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                            <Play className="h-3.5 w-3.5 fill-white text-white" />
                          </span>
                        ) : null}
                        {isLast && thumbOverflow > 0 ? (
                          <span className="absolute inset-0 flex items-center justify-center bg-shopiq-brand-strong/70 text-xs font-medium text-white">
                            +{thumbOverflow}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          <div
            className="min-w-0 flex-1 border-l-4 pl-3.5"
            style={accentColor ? { borderLeftColor: accentColor } : undefined}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-shopiq-ink">
                {review.author ?? "Amazon customer"}
                {review.verified ? <Badge tone="brand">Verified</Badge> : null}
              </p>
              {review.date ? (
                <span className="shrink-0 text-[11px] text-shopiq-faint">{review.date}</span>
              ) : null}
            </div>
            {typeof review.rating === "number" ? (
              <div className="mt-1.5 mb-2">
                <StarRating rating={review.rating} size={14} color={accentColor} />
              </div>
            ) : null}
            {review.title ? (
              <p className="mb-1.5 text-[15px] font-medium text-shopiq-ink">{review.title}</p>
            ) : null}
            {review.body ? (
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-shopiq-body">{review.body}</p>
            ) : !review.title ? (
              <p className="text-[13px] italic text-shopiq-faint">
                {hasMedia ? "No written review — media only." : "No review text available."}
              </p>
            ) : null}
            {review.helpfulText ? (
              <p className="mt-3 text-[11px] text-shopiq-faint">{review.helpfulText}</p>
            ) : null}
          </div>
        </div>
      )}
    </SideOverlay>
  );
}

type LightboxViewProps = {
  review: ProductReview;
  media: ReturnType<typeof getReviewMedia>;
  index: number;
  accentColor?: string;
  onSelect: (index: number) => void;
};

function LightboxView({ review, media, index, accentColor, onSelect }: LightboxViewProps) {
  const current = media[index];
  const count = media.length;
  const go = (delta: number) => onSelect((index + delta + count) % count);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="relative flex min-h-[260px] flex-1 items-center justify-center bg-[#0d1b2e]">
        {current.kind === "image" ? (
          <img src={current.url} alt="" className="max-h-[58vh] w-full object-contain" />
        ) : current.videoUrl ? (
          <video
            src={current.videoUrl}
            poster={current.thumbnail}
            controls
            playsInline
            className="max-h-[58vh] w-full bg-black object-contain"
          />
        ) : (
          <a
            href={current.link}
            target="_blank"
            rel="noreferrer"
            className="relative flex h-full w-full items-center justify-center"
          >
            {current.thumbnail ? (
              <img src={current.thumbnail} alt="" className="max-h-[58vh] w-full object-contain opacity-90" />
            ) : null}
            <span className="absolute flex h-12 w-12 items-center justify-center rounded-full bg-white/90">
              <Play className="ml-0.5 h-6 w-6 fill-shopiq-brand-strong text-shopiq-brand-strong" />
            </span>
          </a>
        )}

        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous"
              className="absolute left-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next"
              className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <div className="flex gap-2 overflow-x-auto bg-[#0d1b2e] px-3 py-2.5">
          {media.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              className={`relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md border-2 ${
                i === index ? "border-shopiq-brand" : "border-transparent"
              }`}
            >
              <img
                src={item.kind === "video" ? item.thumbnail : item.url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
              {item.kind === "video" ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                  <Play className="h-3 w-3 fill-white text-white" />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      <div className="border-t border-shopiq-border bg-shopiq-panel px-4 py-3">
        <p className="mb-1 flex items-center gap-1.5 text-[11px] text-shopiq-faint">
          {review.author ?? "Amazon customer"}
          {typeof review.rating === "number" ? (
            <StarRating rating={review.rating} size={11} color={accentColor} />
          ) : null}
        </p>
        <p className="line-clamp-2 text-[13px] leading-snug text-shopiq-body">{review.body}</p>
        {current.kind === "video" && !current.videoUrl ? (
          <div className="mt-2 flex items-center justify-between border-t border-shopiq-border pt-2">
            <span className="text-[11px] text-shopiq-faint">Video can't play in the extension</span>
            {current.link ? (
              <a
                href={current.link}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[12px] font-medium text-shopiq-brand hover:text-shopiq-brand-strong"
              >
                Watch on Amazon
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** "4 photos · 1 video" style summary of a review's attached media. */
function describeMedia(review: ProductReview): string {
  const parts: string[] = [];
  const photos = review.images?.length ?? 0;
  if (photos > 0) parts.push(`${photos} photo${photos === 1 ? "" : "s"}`);
  if (review.videoThumbnail) parts.push("1 video");
  return parts.join(" · ");
}
