import { useEffect, useState, type ReactNode } from "react";
import { Ban, PanelRight, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Logo } from "../overlay/atoms/Logo";
import { Button } from "../overlay/atoms/Button";
import {
  AUTO_OPEN_STORAGE_KEY,
  PRIVACY_POLICY_URL,
  RUFUS_ENABLED_STORAGE_KEY,
  SPONSORED_MODE_KEY
} from "../shared/constants";

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isAmazonInUrl(url?: string): boolean {
  if (!url) return false;
  try {
    return new URL(url).hostname.endsWith("amazon.in");
  } catch {
    return false;
  }
}

type SettingsRowProps = {
  testId: string;
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function SettingsRow({ testId, icon, title, description, checked, onChange }: SettingsRowProps) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5">
      <span className="mt-0.5 text-shopiq-muted">{icon}</span>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-xs font-medium text-shopiq-ink">{title}</span>
        <span className="text-[10.5px] leading-snug text-shopiq-muted">{description}</span>
      </span>
      <button
        data-testid={testId}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
          checked ? "bg-shopiq-brand" : "bg-shopiq-border"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

/** Small popup shown from the toolbar icon: lets the user adjust ShopIQ's settings and jump to it on the current tab. */
export function Popup() {
  const [autoOpen, setAutoOpen] = useState(false);
  const [isAmazonTab, setIsAmazonTab] = useState(false);
  const [hideSponsored, setHideSponsored] = useState(false);
  const [rufusEnabled, setRufusEnabled] = useState(false);

  useEffect(() => {
    void (async () => {
      const stored = await chrome.storage.local.get([
        AUTO_OPEN_STORAGE_KEY,
        SPONSORED_MODE_KEY,
        RUFUS_ENABLED_STORAGE_KEY
      ]);
      setAutoOpen(Boolean(stored[AUTO_OPEN_STORAGE_KEY]));
      setHideSponsored(stored[SPONSORED_MODE_KEY] !== "off" && stored[SPONSORED_MODE_KEY] != null);
      setRufusEnabled(Boolean(stored[RUFUS_ENABLED_STORAGE_KEY]));

      const tab = await getActiveTab();
      setIsAmazonTab(isAmazonInUrl(tab?.url));
    })();
  }, []);

  async function toggleAutoOpen(next: boolean) {
    setAutoOpen(next);
    await chrome.storage.local.set({ [AUTO_OPEN_STORAGE_KEY]: next });
  }

  async function toggleHideSponsored(next: boolean) {
    setHideSponsored(next);
    await chrome.storage.local.set({ [SPONSORED_MODE_KEY]: next ? "cover" : "off" });
  }

  async function toggleRufus(next: boolean) {
    setRufusEnabled(next);
    await chrome.storage.local.set({ [RUFUS_ENABLED_STORAGE_KEY]: next });
  }

  async function openNow() {
    const tab = await getActiveTab();
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: "SHOPIQ_SHOW_OVERLAY" });
    }
    window.close();
  }

  return (
    <div
      data-testid="shopiq-popup"
      className="flex w-[280px] flex-col gap-3 bg-shopiq-panel p-3.5 text-shopiq-ink"
    >
      <div className="flex items-center gap-2">
        <Logo className="h-7 w-7 flex-shrink-0" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold">ShopIQ</span>
          <span className="text-[11px] text-shopiq-muted">AI buy assistant for Amazon India</span>
        </div>
      </div>

      <div className="flex flex-col divide-y divide-shopiq-border rounded-xl border border-shopiq-border">
        <SettingsRow
          testId="shopiq-popup-auto-open"
          icon={<Zap className="h-[15px] w-[15px]" />}
          title="Auto-open on product pages"
          description="Otherwise, open ShopIQ from this icon."
          checked={autoOpen}
          onChange={toggleAutoOpen}
        />
        <SettingsRow
          testId="shopiq-popup-rufus"
          icon={<Sparkles className="h-[15px] w-[15px]" />}
          title="Use Amazon AI (Rufus)"
          description="Ask Amazon's on-page assistant for price history & AI pros/cons. Sends a prompt on your behalf."
          checked={rufusEnabled}
          onChange={toggleRufus}
        />
        <SettingsRow
          testId="shopiq-popup-hide-sponsored"
          icon={<Ban className="h-[15px] w-[15px]" />}
          title="Block sponsored products"
          description="Cover ads with a black overlay."
          checked={hideSponsored}
          onChange={toggleHideSponsored}
        />
      </div>

      <Button
        data-testid="shopiq-popup-open-now"
        className="w-full"
        icon={<PanelRight className="h-3.5 w-3.5" />}
        onClick={openNow}
        disabled={!isAmazonTab}
      >
        Open ShopIQ
      </Button>
      {!isAmazonTab ? (
        <p className="text-center text-[11px] text-shopiq-muted">
          Visit an Amazon India page to open ShopIQ.
        </p>
      ) : null}

      <a
        href={PRIVACY_POLICY_URL}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-1.5 border-t border-shopiq-border pt-2.5 text-[11px] font-medium text-shopiq-brand hover:text-shopiq-brand-strong"
      >
        <ShieldCheck className="h-3 w-3" />
        Privacy policy
      </a>
    </div>
  );
}
