import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
  children: ReactNode;
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-shopiq-brand text-white hover:bg-shopiq-brand-strong",
  secondary: "border border-shopiq-border bg-shopiq-panel text-shopiq-ink hover:bg-shopiq-surface",
  ghost: "text-shopiq-brand hover:bg-shopiq-brand-soft",
  outline:
    "border border-shopiq-border bg-shopiq-panel text-shopiq-brand-strong hover:border-shopiq-brand hover:bg-shopiq-brand hover:text-white"
};

export function Button({ variant = "primary", icon, children, className = "", ...props }: ButtonProps) {
  return (
    <button
      data-testid={`shopiq-button-${variant}`}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${className}`}
      type="button"
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
