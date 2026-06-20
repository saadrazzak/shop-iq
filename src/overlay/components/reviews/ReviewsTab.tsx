import { useState } from "react";
import { Filter } from "lucide-react";
import type {
  AnalysisResult,
  ProductData,
  ProductReview,
  ReviewScanOptions,
  ReviewScanProgress,
  ScanResult
} from "../../../shared/types";
import { Card } from "../../atoms/Card";
import { AnalysisPending } from "../AnalysisPending";
import { ReviewScanner } from "./ReviewScanner";
import { ReviewsList } from "./ReviewsList";
import { ReviewDetail } from "./ReviewDetail";

type ReviewsTabProps = {
  product: ProductData;
  analysis?: AnalysisResult;
  isBusy: boolean;
  /** Set when the last analysis attempt failed; surfaced in the pending card. */
  error?: string;
  scanProgress?: ReviewScanProgress;
  scanResult?: ScanResult;
  onAnalyze: () => void;
  onAnalyzeMore: (options: ReviewScanOptions) => void;
};

/** Best/worst analysis highlights first, then the rest of the page's reviews (deduped). */
function buildReviewList(product: ProductData, analysis?: AnalysisResult): ProductReview[] {
  const highlighted = [analysis?.bestReview, analysis?.worstReview].filter(
    (review): review is ProductReview => Boolean(review)
  );
  const seen = new Set(highlighted.map((review) => review.domId ?? review.body));
  const rest = product.reviews.filter((review) => !seen.has(review.domId ?? review.body));
  return [...highlighted, ...rest];
}

export function ReviewsTab({
  product,
  analysis,
  isBusy,
  error,
  scanProgress,
  scanResult,
  onAnalyze,
  onAnalyzeMore
}: ReviewsTabProps) {
  const [selectedReview, setSelectedReview] = useState<ProductReview | null>(null);

  return (
    <div data-testid="shopiq-reviews-tab" className="flex flex-col gap-3 p-3.5">
      {!analysis ? <AnalysisPending isBusy={isBusy} onAnalyze={onAnalyze} message={error} /> : null}
      <ReviewScanner
        isBusy={isBusy}
        reviewsAnalyzed={analysis?.reviewsAnalyzed}
        scanProgress={scanProgress}
        savedOptions={scanResult?.options}
        onScan={onAnalyzeMore}
        isSignedIn={product.isSignedIn}
      />
      {scanResult ? (
        scanResult.reviews.length > 0 ? (
          <ReviewsList reviews={scanResult.reviews} title="Filtered reviews" onSelect={setSelectedReview} activeReview={selectedReview} />
        ) : (
          <Card
            data-testid="shopiq-reviews-empty"
            className="flex items-center gap-2 p-3 text-xs text-shopiq-body"
          >
            <Filter className="h-3.5 w-3.5 text-shopiq-faint" />
            No reviews matched this filter. Try a different combination.
          </Card>
        )
      ) : (
        <ReviewsList
          reviews={buildReviewList(product, analysis)}
          onSelect={setSelectedReview}
          activeReview={selectedReview}
        />
      )}

      {selectedReview ? (
        <ReviewDetail review={selectedReview} onClose={() => setSelectedReview(null)} />
      ) : null}
    </div>
  );
}
