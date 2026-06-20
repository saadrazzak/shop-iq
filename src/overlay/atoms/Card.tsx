import type { CSSProperties, ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  style?: CSSProperties;
  "data-testid"?: string;
};

/** White surface with the standard ShopIQ border, rounding, and a subtle drop shadow. */
export function Card({
  children,
  className = "",
  id,
  style,
  "data-testid": testId = "shopiq-card"
}: CardProps) {
  return (
    <div
      id={id}
      data-testid={testId}
      className={`rounded-2xl border border-shopiq-border bg-shopiq-panel ${className}`}
      style={{ boxShadow: "var(--shopiq-shadow-card)", ...style }}
    >
      {children}
    </div>
  );
}
