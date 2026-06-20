import { getConfig } from "../config";
import type { SponsoredMode } from "../shared/constants";

function getCardSelector(): string {
  return getConfig().amazon.selectors.sponsoredCardSelectors.join(", ");
}

const COVER_ATTR = "data-shopiq-covered";
const HIDE_ATTR = "data-shopiq-hidden";
const COVER_CLASS = "shopiq-sponsored-cover";
const COUNTER_ID = "shopiq-ad-counter";

const COVER_STYLE =
  "position:absolute; inset:0; z-index:99; display:flex; flex-direction:column; align-items:center;" +
  " justify-content:center; gap:4px; padding:8px; box-sizing:border-box; overflow:hidden; text-align:center;" +
  " background:#000; color:#fff; font-family:Arial, Helvetica, sans-serif; transition:background 0.15s ease;" +
  " pointer-events:auto;";

const TEXT_GROUP_STYLE =
  "display:flex; flex-direction:column; align-items:center; gap:3px; max-width:100%; transition:visibility 0.15s ease;";

const LABEL_ROW_STYLE = "display:flex; align-items:center; justify-content:center; gap:5px;";

const LABEL_STYLE =
  "font-size:13px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; line-height:1.2;";

const BLOCKED_ICON_STYLE = "flex-shrink:0; color:#ef4444;";

const DESCRIPTION_STYLE =
  "font-size:11px; font-weight:400; letter-spacing:normal; text-transform:none; color:#cbd5e1; line-height:1.2;" +
  " max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;";

const TOGGLE_STYLE =
  "position:absolute; top:6px; right:6px; width:28px; height:28px; display:flex; align-items:center;" +
  " justify-content:center; border-radius:9999px; border:none; background:rgba(0,0,0,0.6); color:#fff;" +
  " cursor:pointer; pointer-events:auto; padding:0;";

const EYE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"' +
  ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';

const EYE_OFF_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"' +
  ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M10.73 5.08A10.75 10.75 0 0 1 21.94 11.65a1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.44 2.49"/>' +
  '<path d="M14.08 14.16a3 3 0 0 1-4.24-4.24"/>' +
  '<path d="M17.48 17.5A10.75 10.75 0 0 1 2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14"/>' +
  '<path d="m2 2 20 20"/></svg>';

const BLOCKED_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"' +
  ' stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
  '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>';

/** Tracks the last applied mode so we can skip resetAll when mode hasn't changed. */
let activeMode: SponsoredMode = "off";

function findSponsoredLabels(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("span, a")).filter((el) => {
    const ownText = Array.from(el.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent?.trim() ?? "")
      .join("");
    return ownText.toLowerCase() === "sponsored";
  });
}

function findCardAncestor(label: HTMLElement): HTMLElement | null {
  let current = label.parentElement;
  while (current && current !== document.body) {
    if (current.matches(getCardSelector())) return current;
    current = current.parentElement;
  }
  return null;
}

function getSponsoredCards(): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  for (const label of findSponsoredLabels()) {
    const card = findCardAncestor(label);
    if (card) seen.add(card);
  }
  return Array.from(seen);
}

function summarize(text: string | null | undefined, maxWords: number): string | undefined {
  const normalized = text?.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  const words = normalized.split(" ");
  const picked = words.slice(0, maxWords).join(" ");
  return words.length > maxWords ? `${picked}…` : picked;
}

function describeCard(card: HTMLElement): string | undefined {
  const { carouselContainer, carouselCard, carouselHeading } = getConfig().amazon.selectors;
  const isCarousel = card.matches(carouselContainer) || card.querySelectorAll(carouselCard).length > 1;
  if (isCarousel) return summarize(card.querySelector(carouselHeading)?.textContent, 5);
  const fromImage = summarize(card.querySelector("img[alt]")?.getAttribute("alt"), 4);
  return fromImage ?? summarize(card.querySelector("h2")?.textContent, 4);
}

function buildCover(description?: string): HTMLDivElement {
  const cover = document.createElement("div");
  cover.className = COVER_CLASS;
  cover.setAttribute("style", COVER_STYLE);

  const textGroup = document.createElement("div");
  textGroup.setAttribute("style", TEXT_GROUP_STYLE);

  const labelRow = document.createElement("div");
  labelRow.setAttribute("style", LABEL_ROW_STYLE);

  const blockedIcon = document.createElement("span");
  blockedIcon.setAttribute("style", BLOCKED_ICON_STYLE);
  blockedIcon.innerHTML = BLOCKED_ICON;
  labelRow.appendChild(blockedIcon);

  const label = document.createElement("span");
  label.textContent = "Sponsored";
  label.setAttribute("style", LABEL_STYLE);
  labelRow.appendChild(label);
  textGroup.appendChild(labelRow);

  if (description) {
    const sub = document.createElement("span");
    sub.textContent = description;
    sub.setAttribute("style", DESCRIPTION_STYLE);
    textGroup.appendChild(sub);
  }
  cover.appendChild(textGroup);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.setAttribute("style", TOGGLE_STYLE);
  toggle.setAttribute("aria-label", "Show sponsored content");
  toggle.innerHTML = EYE_ICON;
  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const revealed = cover.dataset.revealed === "true";
    cover.dataset.revealed = revealed ? "false" : "true";
    cover.style.background = revealed ? "#000" : "transparent";
    cover.style.pointerEvents = revealed ? "auto" : "none";
    textGroup.style.visibility = revealed ? "visible" : "hidden";
    toggle.innerHTML = revealed ? EYE_ICON : EYE_OFF_ICON;
    toggle.setAttribute("aria-label", revealed ? "Show sponsored content" : "Hide sponsored content");
  });
  cover.appendChild(toggle);
  return cover;
}

function resetAll(): void {
  // Uncover
  document.querySelectorAll<HTMLElement>(`[${COVER_ATTR}]`).forEach((el) => {
    el.querySelectorAll(`.${COVER_CLASS}`).forEach((c) => c.remove());
    if (el.dataset.shopiqOriginalPosition === "static") {
      el.style.removeProperty("position");
      delete el.dataset.shopiqOriginalPosition;
    }
    el.removeAttribute(COVER_ATTR);
  });

  // Unhide
  document.querySelectorAll<HTMLElement>(`[${HIDE_ATTR}]`).forEach((el) => {
    el.style.removeProperty("display");
    el.removeAttribute(HIDE_ATTR);
  });
}

function coverCards(cards: HTMLElement[]): void {
  cards.forEach((card) => {
    if (card.hasAttribute(COVER_ATTR)) return;
    card.setAttribute(COVER_ATTR, "true");
    if (getComputedStyle(card).position === "static") {
      card.dataset.shopiqOriginalPosition = "static";
      card.style.position = "relative";
    }
    card.appendChild(buildCover(describeCard(card)));
  });
}

function hideCards(cards: HTMLElement[]): void {
  cards.forEach((card) => {
    if (card.hasAttribute(HIDE_ATTR)) return;
    card.setAttribute(HIDE_ATTR, "true");
    card.style.display = "none";
  });
}

function updateCounterChip(count: number, mode: SponsoredMode): void {
  const existing = document.getElementById(COUNTER_ID);

  if (count === 0) {
    existing?.remove();
    return;
  }

  const verb = mode === "cover" ? "covered" : "removed";
  const text = `${count} ad${count !== 1 ? "s" : ""} ${verb}`;

  const chip = existing ?? (() => {
    const el = document.createElement("div");
    el.id = COUNTER_ID;
    el.style.cssText =
      "position:fixed; bottom:72px; left:12px; z-index:2147483646;" +
      "background:#51829B; color:#fff; font-family:Arial,Helvetica,sans-serif;" +
      "font-size:11px; font-weight:600; padding:5px 10px; border-radius:20px;" +
      "pointer-events:none; letter-spacing:0.03em; box-shadow:0 2px 8px rgba(0,0,0,0.2);";
    document.body.appendChild(el);
    return el;
  })();

  chip.textContent = text;
}

export function applySponsored(mode: SponsoredMode, showCounter: boolean): void {
  // Only tear down and rebuild when switching modes — avoids the
  // resetAll → DOM move → MutationObserver → resetAll flicker loop.
  if (mode !== activeMode) {
    resetAll();
    activeMode = mode;
  }

  if (mode === "off") {
    document.getElementById(COUNTER_ID)?.remove();
    return;
  }

  // Only act on cards not yet processed in this mode.
  const processedAttr = mode === "cover" ? COVER_ATTR : HIDE_ATTR;
  const newCards = getSponsoredCards().filter((card) => !card.hasAttribute(processedAttr));

  if (mode === "cover") coverCards(newCards);
  else if (mode === "remove") hideCards(newCards);

  // Count all processed cards (existing + newly handled) for the chip.
  const total = document.querySelectorAll(`[${processedAttr}]`).length;
  if (showCounter) updateCounterChip(total, mode);
  else document.getElementById(COUNTER_ID)?.remove();
}
