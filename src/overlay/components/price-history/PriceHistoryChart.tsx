import { useEffect, useRef } from "react";
import {
  CategoryScale,
  Chart,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  type Plugin,
  PointElement,
  Tooltip
} from "chart.js";
import type { PricePoint } from "../../lib/priceHistory";
import { formatCurrency } from "../../../shared/utils/format";

Chart.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Tooltip, Filler);

type PriceHistoryChartProps = {
  points: PricePoint[];
  /** Canvas height in px. Defaults to the compact inline size; the expanded overlay passes a larger value, which also scales up the hover tooltip and axis text. */
  height?: number;
};

/** Above this height the chart is treated as the "big" expanded-overlay view, so the hover tooltip and axis text scale up to match. */
const LARGE_CHART_HEIGHT = 300;

/** Reads a `--color-shopiq-*` custom property as a literal color, falling back if unresolved (canvas can't use `var()`). */
function readColor(element: Element, name: string, fallback: string): string {
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  return value || fallback;
}

/** Draws a dashed vertical line through the hovered point, spanning the full plot area, so the price-at-this-date is easy to read off the x-axis. */
function createCrosshairPlugin(color: string): Plugin<"line"> {
  return {
    id: "shopiqCrosshair",
    afterDatasetsDraw(chart) {
      const [active] = chart.tooltip?.getActiveElements() ?? [];
      if (!active) return;

      const { ctx, chartArea } = chart;
      const x = active.element.x;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.lineWidth = 1;
      ctx.strokeStyle = color;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    }
  };
}

/** Marks today's price with a solid dot, since per-point dots are otherwise turned off to avoid clutter on long (3-month+) series. */
function createNowBadgePlugin(dotColor: string, labelColor: string, fontSize: number): Plugin<"line"> {
  return {
    id: "shopiqNowBadge",
    afterDatasetsDraw(chart) {
      const meta = chart.getDatasetMeta(0);
      const point = meta.data[meta.data.length - 1];
      if (!point) return;

      const { ctx } = chart;
      ctx.save();
      ctx.font = `600 ${fontSize}px sans-serif`;
      ctx.fillStyle = labelColor;
      ctx.textAlign = "right";
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(point.x, point.y, fontSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  };
}

/**
 * Clean, minimal line chart of daily prices: a single-color smooth filled
 * line (no per-point dots, which got noisy on long series), a dashed gray
 * reference line at the average price for context, and one solid dot
 * marking today's price. Hovering anywhere shows a crosshair and a tooltip
 * — both scale up on the larger expanded-overlay chart (`height` >=
 * `LARGE_CHART_HEIGHT`).
 */
export function PriceHistoryChart({ points, height = 180 }: PriceHistoryChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<"line"> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const brand = readColor(canvas, "--color-shopiq-brand", "#2d6cdf");
    const ink = readColor(canvas, "--color-shopiq-ink", "#1f2937");
    const slate = readColor(canvas, "--color-shopiq-slate", "#9ca3af");

    const prices = points.map((point) => point.price);
    const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const isLarge = height >= LARGE_CHART_HEIGHT;
    const axisFontSize = isLarge ? 11 : 9;
    const nowBadgeFontSize = isLarge ? 13 : 10;

    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: points.map((point) => point.label),
        datasets: [
          {
            data: prices,
            borderColor: brand,
            backgroundColor: `${brand}1a`,
            borderWidth: isLarge ? 3 : 2,
            pointRadius: 0,
            pointHoverRadius: isLarge ? 6 : 5,
            pointHoverBackgroundColor: brand,
            pointHoverBorderColor: "#fff",
            pointHoverBorderWidth: 2,
            tension: 0.25,
            fill: true
          },
          {
            data: prices.map(() => average),
            borderColor: slate,
            borderWidth: 1,
            borderDash: [4, 4],
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        // "index" + intersect:false: hovering anywhere over the chart (not just
        // directly on a point/line) highlights the nearest date's value.
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            backgroundColor: ink,
            titleColor: slate,
            titleFont: { size: isLarge ? 13 : 10, weight: "normal" },
            bodyColor: "#fff",
            bodyFont: { size: isLarge ? 16 : 12, weight: "bold" },
            padding: isLarge ? 12 : 8,
            cornerRadius: isLarge ? 8 : 6,
            // Only the price line gets a tooltip entry - the average-price
            // reference line would just repeat the same number every time.
            filter: (item) => item.datasetIndex === 0,
            callbacks: {
              title: (items) => items[0]?.label ?? "",
              label: (context) => formatCurrency(context.parsed.y ?? undefined)
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 0, autoSkip: true, font: { size: axisFontSize } }
          },
          y: {
            grid: { color: "rgba(0, 0, 0, 0.05)" },
            ticks: { font: { size: axisFontSize }, callback: (value) => `₹${value}` }
          }
        }
      },
      plugins: [createCrosshairPlugin(`${brand}66`), createNowBadgePlugin(brand, ink, nowBadgeFontSize)]
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [points, height]);

  return (
    <div data-testid="shopiq-price-history-chart" className="mt-1" style={{ height }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
