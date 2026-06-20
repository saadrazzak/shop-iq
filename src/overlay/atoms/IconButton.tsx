import type { ReactNode } from "react";

type IconButtonProps = {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
};

/** Compact, icon-only button used for overlay header controls. */
export function IconButton({ label, onClick, children, className = "" }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      data-testid={`shopiq-icon-button-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className={`grid h-7 w-7 place-items-center rounded-md text-current opacity-85 transition hover:bg-white/15 hover:opacity-100 ${className}`}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}
