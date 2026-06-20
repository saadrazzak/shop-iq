import { PALETTE } from "../lib/palette";

type ProgressBarProps = {
  /** 0–100. */
  percent: number;
  color?: string;
  className?: string;
};

/** Thin horizontal bar on a cream track, used for ratings and sentiment. */
export function ProgressBar({ percent, color = PALETTE.brand, className = "" }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      data-testid="shopiq-progress-bar"
      className={`h-1.5 overflow-hidden rounded-full bg-shopiq-cream ${className}`}
    >
      <div className="h-full rounded-full" style={{ width: `${clamped}%`, background: color }} />
    </div>
  );
}
