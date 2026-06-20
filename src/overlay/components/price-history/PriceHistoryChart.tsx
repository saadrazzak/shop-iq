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
};

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

/** Line chart of daily prices, with the lowest point highlighted in the accent color. Hovering anywhere over the chart shows a crosshair and the price for that date. */
export function PriceHistoryChart({ points }: PriceHistoryChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<"line"> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const brand = readColor(canvas, "--color-shopiq-brand", "#2d6cdf");
    const accent = readColor(canvas, "--color-shopiq-accent", "#ff6b4a");
    const ink = readColor(canvas, "--color-shopiq-ink", "#1f2937");
    const slate = readColor(canvas, "--color-shopiq-slate", "#9ca3af");
    const lowestPrice = Math.min(...points.map((point) => point.price));

    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: points.map((point) => point.label),
        datasets: [
          {
            data: points.map((point) => point.price),
            borderColor: brand,
            backgroundColor: `${brand}1f`,
            pointBackgroundColor: points.map((point) => (point.price === lowestPrice ? accent : brand)),
            pointRadius: points.map((point) => (point.price === lowestPrice ? 4 : 1.5)),
            pointHoverRadius: 5,
            pointHoverBackgroundColor: brand,
            pointHoverBorderColor: "#fff",
            pointHoverBorderWidth: 2,
            borderWidth: 2,
            tension: 0.3,
            fill: true
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
            titleFont: { size: 10, weight: "normal" },
            bodyColor: "#fff",
            bodyFont: { size: 12, weight: "bold" },
            padding: 8,
            cornerRadius: 6,
            callbacks: {
              title: (items) => items[0]?.label ?? "",
              label: (context) => formatCurrency(context.parsed.y ?? undefined)
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 0, autoSkip: true, font: { size: 9 } }
          },
          y: {
            grid: { color: "rgba(0, 0, 0, 0.05)" },
            ticks: { font: { size: 9 }, callback: (value) => `₹${value}` }
          }
        }
      },
      plugins: [createCrosshairPlugin(`${brand}66`)]
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [points]);

  return (
    <div data-testid="shopiq-price-history-chart" className="mt-1" style={{ height: 180 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
