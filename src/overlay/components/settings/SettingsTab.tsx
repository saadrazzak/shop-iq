import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Switch } from "../../atoms/Switch";
import { SegmentedControl } from "../../atoms/SegmentedControl";
import {
  HIDE_SPONSORED_STORAGE_KEY,
  SPONSORED_COUNTER_KEY,
  SPONSORED_MODE_KEY,
  type SponsoredMode
} from "../../../shared/constants";
import { useRufusConsent } from "../../hooks/useRufusConsent";

const MODE_DESCRIPTIONS: Record<SponsoredMode, string> = {
  off: "Ads shown normally",
  cover: "Ads covered with a badge — tap the eye to peek",
  remove: "Ads completely hidden from the page"
};

export function SettingsTab() {
  const [mode, setMode] = useState<SponsoredMode>("off");
  const [showCounter, setShowCounter] = useState(false);
  const { enabled: rufusEnabled, setEnabled: setRufusEnabled } = useRufusConsent();

  useEffect(() => {
    void chrome.storage.local
      .get([SPONSORED_MODE_KEY, SPONSORED_COUNTER_KEY, HIDE_SPONSORED_STORAGE_KEY])
      .then((stored) => {
        const savedMode = stored[SPONSORED_MODE_KEY] as SponsoredMode | undefined;
        setMode(savedMode ?? (stored[HIDE_SPONSORED_STORAGE_KEY] ? "cover" : "off"));
        setShowCounter(Boolean(stored[SPONSORED_COUNTER_KEY]));
      });
  }, []);

  function updateMode(next: SponsoredMode) {
    setMode(next);
    void chrome.storage.local.set({ [SPONSORED_MODE_KEY]: next });
  }

  function updateCounter(next: boolean) {
    setShowCounter(next);
    void chrome.storage.local.set({ [SPONSORED_COUNTER_KEY]: next });
  }

  return (
    <div data-testid="shopiq-settings-tab" className="flex flex-col gap-4 p-3.5">
      <p className="text-[14px] font-medium text-shopiq-brand-strong">Settings</p>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-shopiq-ink">
          <Sparkles className="h-3.5 w-3.5 text-shopiq-brand" />
          Use Amazon AI (Rufus)
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] leading-snug text-shopiq-muted">
            Sends a prompt to Amazon's on-page assistant to fetch price history &amp; AI pros/cons.
          </p>
          <Switch
            testId="shopiq-setting-rufus"
            checked={rufusEnabled}
            onChange={setRufusEnabled}
            label=""
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <SegmentedControl
          label="Sponsored ads"
          testId="shopiq-setting-sponsored-mode"
          value={mode}
          onChange={updateMode}
          options={[
            { id: "off", label: "Off" },
            { id: "cover", label: "Cover" },
            { id: "remove", label: "Remove" }
          ]}
        />
        <p className="text-[10px] text-shopiq-muted">{MODE_DESCRIPTIONS[mode]}</p>
      </div>

      {mode !== "off" ? (
        <Switch
          testId="shopiq-setting-sponsored-counter"
          checked={showCounter}
          onChange={updateCounter}
          label="Show ad count on page"
        />
      ) : null}
    </div>
  );
}
