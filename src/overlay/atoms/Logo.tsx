type LogoProps = {
  className?: string;
};

/** ShopIQ mark: a violet magnifying glass with an orange spark, on a white badge. */
export function Logo({ className = "h-5 w-5" }: LogoProps) {
  return (
    <svg viewBox="0 0 128 128" className={className} role="img" aria-label="ShopIQ">
      <circle cx="64" cy="64" r="62" fill="#ffffff" />
      <circle cx="56" cy="56" r="26" fill="none" stroke="var(--color-shopiq-tab-active)" strokeWidth="12" />
      <line
        x1="75"
        y1="75"
        x2="98"
        y2="98"
        stroke="var(--color-shopiq-tab-active)"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="M 100 6 L 106 21 L 122 28 L 106 35 L 100 50 L 94 35 L 78 28 L 94 21 Z"
        fill="var(--color-shopiq-accent)"
      />
    </svg>
  );
}
