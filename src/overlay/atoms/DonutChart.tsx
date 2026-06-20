import type { ReactNode } from "react";

export type DonutSegment = {
  value: number;
  color: string;
};

type DonutChartProps = {
  segments: DonutSegment[];
  size?: number;
  /** Thickness of the ring in pixels. */
  thickness?: number;
  children?: ReactNode;
};

/** Donut chart built from a conic-gradient, with optional centered content. */
export function DonutChart({ segments, size = 84, thickness = 10, children }: DonutChartProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;

  // Each segment occupies the arc from the running total before it to after it.
  // Computed from prefix sums (segments are few) rather than a mutable cursor,
  // so nothing is reassigned during render.
  const stops = segments
    .map((segment, index) => {
      const startValue = segments.slice(0, index).reduce((sum, item) => sum + item.value, 0);
      const start = (startValue / total) * 100;
      const end = ((startValue + segment.value) / total) * 100;
      return `${segment.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div
      data-testid="shopiq-donut-chart"
      className="relative flex-shrink-0 rounded-full"
      style={{ width: size, height: size, background: `conic-gradient(${stops})` }}
    >
      <div className="absolute rounded-full bg-shopiq-panel" style={{ inset: thickness }}>
        <div className="flex h-full w-full flex-col items-center justify-center">{children}</div>
      </div>
    </div>
  );
}
