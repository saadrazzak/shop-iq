import { ArrowRight, CheckCircle, Minus, Plus, Scale, Sparkles, XCircle } from "lucide-react";
import { CollapsibleCard } from "../../atoms/CollapsibleCard";
import { Spinner } from "../../atoms/Spinner";

type ProsConsCardProps = {
  pros: string[];
  cons: string[];
  /** True while the on-demand AI pros/cons are being fetched — shows a header spinner; the visible (fallback) items stay up. */
  loading?: boolean;
  /**
   * CSS selector of an Amazon page section to scroll to when the user clicks
   * "View on page" in the pros column. Only shown when pros come from the
   * brand snapshot (signed-out fallback).
   */
  prosPageSelector?: string;
  /** True when the user hasn't consented to Amazon's AI — the page-derived fallback is shown with an enable hint. */
  aiDisabled?: boolean;
  /** True once AI-generated pros are in use (hides the enable hint). */
  usingAiPros?: boolean;
  /** Grants Rufus consent from the inline hint. */
  onEnableAi?: () => void;
  /** Called when the section is first expanded — used to lazily fetch the AI pros/cons. */
  onExpand?: () => void;
};

type ColumnProps = {
  title: string;
  items: string[];
  positive: boolean;
  pageSelector?: string;
};

function Column({ title, items, positive, pageSelector }: ColumnProps) {
  const dotColor = positive ? "text-green-600" : "text-red-600";

  function scrollToSection() {
    document.querySelector(pageSelector!)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div data-testid={`shopiq-pros-cons-card-${positive ? "pros" : "cons"}`}>
      <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-shopiq-ink">
        {positive ? (
          <CheckCircle className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-red-600" />
        )}
        {title}
      </p>
      <ul className="flex flex-col gap-1.5 text-xs text-shopiq-body">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-1.5">
            <span className={`mt-0.5 flex-shrink-0 text-[8px] leading-none ${dotColor}`}>●</span>
            <span className="flex-1">{item}</span>
          </li>
        ))}
      </ul>
      {pageSelector ? (
        <button
          type="button"
          onClick={scrollToSection}
          className="mt-2.5 flex items-center gap-1 text-[10px] text-shopiq-muted transition-colors hover:text-shopiq-brand"
        >
          View on page
          <ArrowRight className="h-2.5 w-2.5" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Collapsible pros & cons. Shows page-derived pros/cons immediately; expanding
 * the section lazily fetches Amazon AI pros/cons (via `onExpand`) and swaps them
 * in when ready. Cons column is omitted when there are no cons.
 */
export function ProsConsCard({
  pros,
  cons,
  loading,
  prosPageSelector,
  aiDisabled,
  usingAiPros,
  onEnableAi,
  onExpand
}: ProsConsCardProps) {
  const hasCons = cons.length > 0;

  // While the AI answer is in flight, show only a spinner — never the fallback
  // data — so the content doesn't visibly swap out from under the user.
  const accessory = loading ? (
    <Spinner className="h-3.5 w-3.5 text-shopiq-faint" />
  ) : (
    <span className="flex items-center gap-1.5">
      <span className="flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[11px] font-semibold text-green-700">
        <Plus className="h-2.5 w-2.5" strokeWidth={3} />
        {pros.length}
      </span>
      {hasCons ? (
        <span className="flex items-center gap-0.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">
          <Minus className="h-2.5 w-2.5" strokeWidth={3} />
          {cons.length}
        </span>
      ) : null}
    </span>
  );

  return (
    <CollapsibleCard
      testId="shopiq-pros-cons-card"
      title="Pros & Cons"
      icon={<Scale className="h-4 w-4" />}
      accessory={accessory}
      defaultOpen={false}
      onOpen={onExpand}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-shopiq-muted">
          <Spinner className="h-4 w-4 text-shopiq-brand" />
          Asking Amazon's AI…
        </div>
      ) : (
        <>
          <div className={hasCons ? "grid grid-cols-2 gap-3" : "w-full"}>
            <Column title="Pros" items={pros} positive pageSelector={prosPageSelector} />
            {hasCons ? <Column title="Cons" items={cons} positive={false} /> : null}
          </div>
          {aiDisabled && !usingAiPros ? (
            <div
              data-testid="shopiq-pros-cons-consent"
              className="mt-3 flex items-start gap-2 border-t border-shopiq-border pt-2.5 text-[10.5px] leading-relaxed text-shopiq-muted"
            >
              <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-shopiq-brand" />
              <span>
                Pros &amp; cons come from Amazon's on-page AI.{" "}
                <button
                  type="button"
                  onClick={onEnableAi}
                  className="font-medium text-shopiq-brand hover:text-shopiq-brand-strong"
                >
                  Enable Amazon AI
                </button>{" "}
                to generate them.
              </span>
            </div>
          ) : null}
        </>
      )}
    </CollapsibleCard>
  );
}
