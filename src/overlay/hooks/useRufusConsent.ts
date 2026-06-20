import { useEffect, useState } from "react";
import { RUFUS_ENABLED_STORAGE_KEY } from "../../shared/constants";

/**
 * Reads and writes the user's consent to query Amazon's on-page AI assistant
 * (Rufus) for price history and AI pros/cons. Opt-in (defaults to `false`).
 * Listens for storage changes so the popup toggle and the in-overlay toggle
 * stay in sync live, and so enabling from a consent card updates every surface.
 */
export function useRufusConsent() {
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    void chrome.storage.local
      .get(RUFUS_ENABLED_STORAGE_KEY)
      .then((stored) => setEnabledState(Boolean(stored[RUFUS_ENABLED_STORAGE_KEY])));

    function handleChange(changes: Record<string, chrome.storage.StorageChange>, area: string) {
      if (area !== "local" || !(RUFUS_ENABLED_STORAGE_KEY in changes)) return;
      setEnabledState(Boolean(changes[RUFUS_ENABLED_STORAGE_KEY].newValue));
    }

    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  }, []);

  function setEnabled(next: boolean) {
    setEnabledState(next); // optimistic; the storage listener confirms
    void chrome.storage.local.set({ [RUFUS_ENABLED_STORAGE_KEY]: next });
  }

  return { enabled, setEnabled };
}
