import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type CollapsibleCardProps = {
  title: string;
  /** Icon rendered inside a rounded tile on the left. */
  icon?: ReactNode;
  /** Muted second line under the title, visible in both states (e.g. a seller name or "3 pros · 3 cons"). */
  subtitle?: ReactNode;
  /** Right-aligned metric shown before the chevron in both states (e.g. a rating or count pills). */
  accessory?: ReactNode;
  defaultOpen?: boolean;
  /** Fired when the card transitions from collapsed to expanded (e.g. to lazily load its data). */
  onOpen?: () => void;
  children: ReactNode;
  testId?: string;
};

/** Card with a structured header (icon tile · title+subtitle · metric) whose body folds away on tap. */
export function CollapsibleCard({
  title,
  icon,
  subtitle,
  accessory,
  defaultOpen = false,
  onOpen,
  children,
  testId = "shopiq-collapsible-card"
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  function toggle() {
    setOpen((value) => {
      if (!value) onOpen?.();
      return !value;
    });
  }

  return (
    <div
      data-testid={testId}
      className="overflow-hidden rounded-2xl border border-shopiq-border bg-shopiq-panel"
      style={{ boxShadow: "var(--shopiq-shadow-card)" }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        {icon ? (
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-shopiq-brand-soft text-shopiq-brand">
            {icon}
          </span>
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[14px] font-medium leading-tight text-shopiq-brand-strong">{title}</span>
          {subtitle ? (
            <span className="mt-0.5 truncate text-[11px] leading-tight text-shopiq-muted">{subtitle}</span>
          ) : null}
        </span>
        <span className="flex flex-shrink-0 items-center gap-2.5">
          {accessory}
          <ChevronDown className={`h-3.5 w-3.5 text-shopiq-faint transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open ? <div className="px-3 pb-3">{children}</div> : null}
    </div>
  );
}
