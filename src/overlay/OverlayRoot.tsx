import { useEffect, useState } from "react";
import App from "./App";
import { LauncherButton } from "./components/LauncherButton";
import { PriceAlertBadge } from "./components/price-history/PriceAlertBadge";
import type { TabId } from "./components/tabs";
import { useProductState } from "./hooks/useProductState";
import { usePriceHistory } from "./hooks/usePriceHistory";
import { useYearlyPriceHistory } from "./hooks/useYearlyPriceHistory";
import { useRufusConsent } from "./hooks/useRufusConsent";
import type { ExtensionMessage } from "../shared/types";

const LAUNCHER_TOP_STORAGE_KEY = "shopiq:launcher-top";
const DEFAULT_LAUNCHER_TOP = 42;
const MIN_LAUNCHER_TOP = 5;
const MAX_LAUNCHER_TOP = 95;

/** How long to wait after the product is detected before asking Amazon's AI assistant for price history — gives the page (and Rufus) a moment to settle. */
const PRICE_HISTORY_AUTO_FETCH_DELAY_MS = 2000;

function clampLauncherTop(value: number): number {
  return Math.min(Math.max(value, MIN_LAUNCHER_TOP), MAX_LAUNCHER_TOP);
}

function getStoredLauncherTop(): number {
  const stored = Number(localStorage.getItem(LAUNCHER_TOP_STORAGE_KEY));
  return Number.isFinite(stored) && stored > 0 ? clampLauncherTop(stored) : DEFAULT_LAUNCHER_TOP;
}

export function OverlayRoot() {
  const [launcherTop, setLauncherTop] = useState(getStoredLauncherTop);
  const { state, ui, scanResult, scanning, scanProgress, setUi, analyzeSnapshot, analyzeMoreReviews } =
    useProductState();
  const { enabled: rufusEnabled, setEnabled: setRufusEnabled } = useRufusConsent();
  const priceHistory = usePriceHistory(state.product, PRICE_HISTORY_AUTO_FETCH_DELAY_MS, rufusEnabled);
  const yearlyPriceHistory = useYearlyPriceHistory(state.product);

  // Visibility and active tab are persisted per-tab (via the background) so the
  // overlay stays open through the review scan's page navigations.
  const visible = ui.open;
  const activeTab = ui.activeTab as TabId;

  useEffect(() => {
    function handleMessage(message: ExtensionMessage) {
      if (message.type === "SHOPIQ_SHOW_OVERLAY") {
        setUi({ open: true });
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistLauncherTop(value: number) {
    setLauncherTop(value);
    localStorage.setItem(LAUNCHER_TOP_STORAGE_KEY, String(value));
  }

  function handleLauncherDrag(topPercent: number) {
    persistLauncherTop(clampLauncherTop(topPercent));
  }

  function openPriceHistory() {
    setUi({ open: true, activeTab: "price-history" });
  }

  if (!visible) {
    return (
      <div
        data-testid="shopiq-launcher-root"
        className="pointer-events-auto fixed right-0 z-[2147483647]"
        style={{ top: `${launcherTop}%` }}
      >
        <LauncherButton onClick={() => setUi({ open: true })} onDrag={handleLauncherDrag} />
        <PriceAlertBadge state={priceHistory.state} onOpen={openPriceHistory} />
      </div>
    );
  }

  return (
    <div
      data-testid="shopiq-overlay-root"
      style={{ boxShadow: "var(--shopiq-shadow-card)" }}
      className="pointer-events-auto fixed top-4 right-4 bottom-4 z-[2147483647]"
    >
      <App
        state={state}
        scanResult={scanResult}
        scanning={scanning}
        scanProgress={scanProgress}
        analyzeSnapshot={analyzeSnapshot}
        analyzeMoreReviews={analyzeMoreReviews}
        priceHistory={priceHistory}
        yearlyPriceHistory={yearlyPriceHistory}
        rufusEnabled={rufusEnabled}
        onEnableRufus={() => setRufusEnabled(true)}
        activeTab={activeTab}
        onTabChange={(tab) => setUi({ activeTab: tab })}
        onClose={() => setUi({ open: false })}
      />
      <PriceAlertBadge state={priceHistory.state} onOpen={openPriceHistory} />
    </div>
  );
}
