import { useRef } from "react";
import { Search } from "lucide-react";

const DRAG_THRESHOLD_PX = 4;

type LauncherButtonProps = {
  onClick: () => void;
  onDrag: (topPercent: number) => void;
};

/**
 * Small docked launcher tab on the right edge. A pointer move beyond the drag
 * threshold repositions it vertically; a clean press without movement opens
 * the overlay.
 */
export function LauncherButton({ onClick, onDrag }: LauncherButtonProps) {
  const isDraggingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const startYRef = useRef(0);

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startYRef.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!isDraggingRef.current) return;

    if (!hasMovedRef.current && Math.abs(event.clientY - startYRef.current) < DRAG_THRESHOLD_PX) {
      return;
    }

    hasMovedRef.current = true;
    onDrag((event.clientY / window.innerHeight) * 100);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    isDraggingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);

    if (!hasMovedRef.current) {
      onClick();
    }
  }

  return (
    <button
      aria-label="Open ShopIQ. Drag to reposition."
      data-testid="shopiq-launcher-button"
      className="shopiq-launcher-pulse grid h-[52px] w-[50px] cursor-grab touch-none place-items-center rounded-l-2xl bg-shopiq-brand-strong text-white transition hover:-translate-x-1 active:cursor-grabbing"
      style={{
        boxShadow: "-2px 3px 14px rgba(30,79,184,0.5)",
        borderLeft: "3px solid var(--color-shopiq-accent)"
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      title="Open ShopIQ. Drag to reposition."
      type="button"
    >
      <Search className="h-6 w-6" strokeWidth={2.5} />
    </button>
  );
}
