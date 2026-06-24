/** chrome.storage.local key for whether the overlay should open itself as soon as a product page is detected. */
export const AUTO_OPEN_STORAGE_KEY = "shopiq:auto-open";

/** @deprecated Use SPONSORED_MODE_KEY instead. */
export const HIDE_SPONSORED_STORAGE_KEY = "shopiq:hide-sponsored";

/** What to do with sponsored placements on Amazon pages. */
export type SponsoredMode = "off" | "cover" | "remove";

/** chrome.storage.local key for the sponsored-ads mode. */
export const SPONSORED_MODE_KEY = "shopiq:sponsored-mode";

/** chrome.storage.local key for whether the ad-count chip is shown on the page. */
export const SPONSORED_COUNTER_KEY = "shopiq:sponsored-counter";

/**
 * chrome.storage.local key for the user's consent to query Amazon's on-page AI
 * assistant (Rufus) for price history and AI pros/cons. Opt-in: defaults to
 * `false`, so ShopIQ never sends a prompt to Rufus until the user enables it.
 */
export const RUFUS_ENABLED_STORAGE_KEY = "shopiq:rufus-enabled";

/** Hosted privacy policy, linked from the toolbar popup. */
export const PRIVACY_POLICY_URL = "https://saadrazzak.github.io/shop-iq/privacy.html";
