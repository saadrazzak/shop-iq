/**
 * JS-side access to the ShopIQ theme, for inline styles where Tailwind utility
 * classes cannot reach (e.g. SVG fills, conic-gradients). Each value below
 * references the matching `--color-shopiq-*` custom property defined in the
 * `@theme` block of `overlay/styles.css`, so retheming (or adding a dark-mode
 * variant) only requires editing that one file - these stay in sync
 * automatically since `var()` is resolved live.
 *
 * `slate` is the one exception: it feeds Pill.tsx's `${color}NN` hex-alpha
 * suffix hack, which only works with a literal hex value. Keep it in sync
 * with `--color-shopiq-slate` in styles.css.
 */
export const PALETTE = {
  cream: "var(--color-shopiq-cream)",
  slate: "#9ca3af",
  brand: "var(--color-shopiq-brand)",
  brandStrong: "var(--color-shopiq-brand-strong)",
  accent: "var(--color-shopiq-accent)",
  accentStrong: "var(--color-shopiq-accent-strong)",
  ink: "var(--color-shopiq-ink)",
  track: "var(--color-shopiq-cream)"
} as const;
