import { Link2 } from "lucide-react";
import type { ReactNode } from "react";

type PillTone = "positive" | "negative" | "mixed" | "neutral";

type PillProps = {
  tone?: PillTone;
  icon?: ReactNode;
  /** Explicit color (e.g. a rating-based red->green scale). Overrides `tone` when set. */
  color?: string;
  /** When set, the pill renders as a button, becomes interactive, and shows a small link icon. */
  onClick?: () => void;
  /** Highlights the pill (e.g. after the user clicks it to open a related overlay) with a solid accent fill. */
  active?: boolean;
  title?: string;
  /** When set, the pill stretches to fill its row and clamps its text to this many lines (with an ellipsis if it overflows), instead of sizing to its content on one line. */
  lines?: 1 | 2;
  children: ReactNode;
};

const TONE_CLASSES: Record<PillTone, string> = {
  positive: "border-shopiq-brand-border bg-shopiq-brand-soft text-shopiq-brand-strong",
  negative: "border-shopiq-accent-border bg-shopiq-accent-soft text-shopiq-accent-strong",
  mixed: "border-shopiq-slate/40 bg-shopiq-slate/15 text-shopiq-brand-strong",
  neutral: "border-shopiq-border bg-shopiq-cream-soft text-shopiq-muted"
};

/** Solid-fill versions of `TONE_CLASSES`, used when `active` is set. */
const ACTIVE_TONE_CLASSES: Record<PillTone, string> = {
  positive: "border-shopiq-brand bg-shopiq-brand text-white",
  negative: "border-shopiq-accent bg-shopiq-accent text-white",
  mixed: "border-shopiq-slate bg-shopiq-slate text-white",
  neutral: "border-shopiq-muted bg-shopiq-muted text-white"
};

const BASE_CLASSES =
  "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium leading-none shadow-sm";
const MULTILINE_CLASSES =
  "flex w-full items-start gap-1 rounded-full border px-2 py-1.5 text-[10px] font-medium leading-snug shadow-sm";
const INTERACTIVE_CLASSES = "cursor-pointer transition-transform hover:scale-105 active:scale-95";
const LINE_CLAMP_CLASSES: Record<1 | 2, string> = {
  1: "line-clamp-1",
  2: "line-clamp-2"
};

/** Rounded sentiment/keyword tag with an optional leading icon. Renders as a button with a link icon when `onClick` is set. */
export function Pill({ tone = "neutral", icon, color, onClick, active, title, lines, children }: PillProps) {
  const Tag = onClick ? "button" : "span";
  const containerClass = lines ? MULTILINE_CLASSES : BASE_CLASSES;
  const interactiveClass = onClick ? INTERACTIVE_CLASSES : "";
  const linkIcon = onClick ? <Link2 className="h-2 w-2 flex-shrink-0 opacity-50" /> : null;
  const testId = onClick ? "shopiq-pill-button" : "shopiq-pill";

  const content = lines ? (
    <span className={`${LINE_CLAMP_CLASSES[lines]} [overflow-wrap:anywhere]`}>{children}</span>
  ) : (
    children
  );

  if (color) {
    return (
      <Tag
        type={onClick ? "button" : undefined}
        onClick={onClick}
        title={title}
        data-testid={testId}
        className={`${containerClass} ${interactiveClass}`}
        style={
          active
            ? { color: "#ffffff", border: `1px solid ${color}`, backgroundColor: color }
            : { color, border: `1px solid ${color}`, backgroundColor: `${color}26` }
        }
      >
        {icon}
        {content}
        {linkIcon}
      </Tag>
    );
  }

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={title}
      data-testid={testId}
      className={`${containerClass} ${active ? ACTIVE_TONE_CLASSES[tone] : TONE_CLASSES[tone]} ${interactiveClass}`}
    >
      {icon}
      {content}
      {linkIcon}
    </Tag>
  );
}
