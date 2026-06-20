import { useEffect, useState } from "react";
import { AlertTriangle, Images, ScanSearch } from "lucide-react";
import type { ReviewScanOptions, ReviewScanProgress, ReviewSort, ReviewStar } from "../../../shared/types";
import { Button } from "../../atoms/Button";
import { Card } from "../../atoms/Card";
import { SegmentedControl } from "../../atoms/SegmentedControl";
import { Spinner } from "../../atoms/Spinner";
import { closeAllPhotosGallery, openAllPhotosGallery } from "../../lib/pageOverlay";

type ReviewScannerProps = {
  isBusy: boolean;
  reviewsAnalyzed?: number;
  scanProgress?: ReviewScanProgress;
  /** Options from the most recent scan, restored so the user's selection persists. */
  savedOptions?: ReviewScanOptions;
  onScan: (options: ReviewScanOptions) => void;
  isSignedIn?: boolean;
};

const SORTS: { id: ReviewSort; label: string }[] = [
  { id: "top", label: "Top" },
  { id: "recent", label: "Most recent" }
];

const STARS: { id: ReviewStar; label: string }[] = [
  { id: "all", label: "All" },
  { id: "five", label: "5★" },
  { id: "four", label: "4★" },
  { id: "three", label: "3★" },
  { id: "two", label: "2★" },
  { id: "one", label: "1★" }
];

const DEFAULT_OPTIONS: ReviewScanOptions = {
  sort: "top",
  verifiedOnly: false,
  star: "all",
  mediaOnly: false
};

type ToggleProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  testId: string;
};

function Toggle({ label, checked, onChange, testId }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-testid={testId}
      className="flex w-full items-center justify-between py-1.5"
      onClick={() => onChange(!checked)}
    >
      <span className="text-xs text-shopiq-ink">{label}</span>
      <span
        className={`relative h-5 w-9 rounded-full transition ${checked ? "bg-shopiq-brand" : "bg-shopiq-cream"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? "left-[18px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

/**
 * Lets the user deepen the review analysis by crawling additional Amazon
 * review pages, filtered by sort order, star rating, verified purchase, and
 * media. The overlay stays open while the scan runs.
 */
export function ReviewScanner({
  isBusy,
  reviewsAnalyzed,
  scanProgress,
  savedOptions,
  onScan,
  isSignedIn
}: ReviewScannerProps) {
  const [options, setOptions] = useState<ReviewScanOptions>(savedOptions ?? DEFAULT_OPTIONS);
  const [photoGalleryActive, setPhotoGalleryActive] = useState(false);

  // Restore the last-used options when they arrive (the overlay remounts after
  // the scan's navigation, so initial state can't capture them synchronously).
  // Keyed on the individual option fields so it only re-runs when the saved
  // values actually change — not whenever the parent passes a fresh object.
  useEffect(() => {
    if (savedOptions) setOptions(savedOptions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedOptions?.sort, savedOptions?.star, savedOptions?.verifiedOnly, savedOptions?.mediaOnly]);

  function update<K extends keyof ReviewScanOptions>(key: K, value: ReviewScanOptions[K]) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  return (
    <Card data-testid="shopiq-review-scanner" className="p-3">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-medium text-shopiq-brand-strong">Analyze more reviews</p>
        <button
          type="button"
          data-testid="shopiq-see-all-photos"
          className={`inline-flex items-center gap-1 text-[11px] font-medium transition rounded px-1.5 py-0.5 ${
            photoGalleryActive
              ? "bg-shopiq-brand text-white"
              : "text-shopiq-brand hover:text-shopiq-brand-strong"
          }`}
          onClick={() => {
            if (photoGalleryActive) {
              closeAllPhotosGallery();
            } else {
              setPhotoGalleryActive(true);
              openAllPhotosGallery(() => setPhotoGalleryActive(false));
            }
          }}
        >
          <Images className="h-3 w-3" />
          See all photos
        </button>
      </div>
      {reviewsAnalyzed ? (
        <p className="mt-0.5 mb-2.5 text-[11px] text-shopiq-faint">
          {reviewsAnalyzed} reviews analyzed so far
        </p>
      ) : (
        <div className="mb-2.5" />
      )}

      <fieldset disabled={isBusy} className={isBusy ? "pointer-events-none opacity-45" : ""}>
        <SegmentedControl
          label="Sort by"
          options={SORTS}
          value={options.sort}
          onChange={(id) => update("sort", id)}
          testId="shopiq-review-scanner-sort"
        />
        <SegmentedControl
          label="Rating"
          options={STARS}
          value={options.star}
          onChange={(id) => update("star", id)}
          testId="shopiq-review-scanner-star"
        />
        <Toggle
          label="Verified purchases only"
          checked={options.verifiedOnly}
          onChange={(checked) => update("verifiedOnly", checked)}
          testId="shopiq-review-scanner-verified"
        />
        <Toggle
          label="With photos & videos"
          checked={options.mediaOnly}
          onChange={(checked) => update("mediaOnly", checked)}
          testId="shopiq-review-scanner-media"
        />
      </fieldset>

      <Button
        variant="outline"
        className="mt-2.5 w-full"
        disabled={isBusy}
        icon={isBusy ? <Spinner /> : <ScanSearch className="h-4 w-4" />}
        onClick={() => onScan(options)}
      >
        {isBusy
          ? scanProgress
            ? `Scanning reviews… page ${scanProgress.page} of ${scanProgress.pageLimit}`
            : "Scanning Amazon reviews…"
          : "Scan review pages"}
      </Button>
      {isBusy ? (
        <p className="mt-2 text-center text-[10px] text-shopiq-faint">
          Fetching reviews from Amazon — this stays on the page.
        </p>
      ) : isSignedIn === false ? (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2">
          <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-500" />
          <p className="text-[10px] leading-snug text-amber-700">
            Amazon limits reviews for signed-out users. Sign in for complete results.
          </p>
        </div>
      ) : null}
    </Card>
  );
}
