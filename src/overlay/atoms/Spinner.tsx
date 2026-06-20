import { Loader2 } from "lucide-react";

type SpinnerProps = {
  className?: string;
};

export function Spinner({ className = "h-4 w-4" }: SpinnerProps) {
  return <Loader2 className={`animate-spin ${className}`} data-testid="shopiq-spinner" aria-hidden />;
}
