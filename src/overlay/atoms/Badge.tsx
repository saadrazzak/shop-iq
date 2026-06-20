import type { ReactNode } from "react";

type BadgeTone = "accent" | "brand" | "neutral";

type BadgeProps = {
  tone?: BadgeTone;
  children: ReactNode;
};

const TONE_CLASSES: Record<BadgeTone, string> = {
  accent: "bg-shopiq-accent text-shopiq-header",
  brand: "bg-shopiq-cream text-shopiq-brand",
  neutral: "bg-shopiq-cream-soft text-shopiq-muted"
};

/** Small status label (e.g. PRO, Verified, Current). */
export function Badge({ tone = "neutral", children }: BadgeProps) {
  return (
    <span
      data-testid={`shopiq-badge-${tone}`}
      className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
