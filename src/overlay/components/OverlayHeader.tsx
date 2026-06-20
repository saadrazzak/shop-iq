import { Minus, X } from "lucide-react";
import { IconButton } from "../atoms/IconButton";
import { Logo } from "../atoms/Logo";

type OverlayHeaderProps = {
  onClose: () => void;
};

/** Charcoal title bar: brand mark and window controls. */
export function OverlayHeader({ onClose }: OverlayHeaderProps) {
  return (
    <header
      data-testid="shopiq-overlay-header"
      className="flex flex-shrink-0 items-center gap-2 bg-shopiq-header px-3.5 py-2 text-shopiq-header-foreground"
    >
      <Logo className="h-7 w-7 flex-shrink-0" />
      <span className="flex-1 text-sm font-medium">ShopIQ</span>
      <IconButton label="Minimize" onClick={onClose}>
        <Minus className="h-4 w-4" />
      </IconButton>
      <IconButton label="Close" onClick={onClose}>
        <X className="h-4 w-4" />
      </IconButton>
    </header>
  );
}
