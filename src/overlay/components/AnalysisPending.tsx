import { MessageSquareText } from "lucide-react";
import { Button } from "../atoms/Button";
import { Card } from "../atoms/Card";
import { Spinner } from "../atoms/Spinner";

type AnalysisPendingProps = {
  isBusy: boolean;
  onAnalyze: () => void;
  message?: string;
};

/** Placeholder shown on analysis-backed tabs before a review analysis runs. */
export function AnalysisPending({ isBusy, onAnalyze, message }: AnalysisPendingProps) {
  return (
    <Card
      data-testid="shopiq-analysis-pending"
      className="flex flex-col items-center gap-2.5 p-5 text-center"
    >
      {isBusy ? (
        <>
          <Spinner className="h-5 w-5 text-shopiq-brand" />
          <p className="text-xs text-shopiq-muted">Analyzing reviews…</p>
        </>
      ) : (
        <>
          <p className="text-xs text-shopiq-muted">
            {message ?? "Run a review analysis to see this section."}
          </p>
          <Button icon={<MessageSquareText className="h-4 w-4" />} onClick={onAnalyze}>
            Analyze reviews
          </Button>
        </>
      )}
    </Card>
  );
}
