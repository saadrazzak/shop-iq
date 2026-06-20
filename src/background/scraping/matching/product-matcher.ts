import type { ProductAttributes } from "../types";

const KNOWN_BRANDS = [
  "apple",
  "samsung",
  "oneplus",
  "google",
  "motorola",
  "xiaomi",
  "redmi",
  "mi",
  "oppo",
  "vivo",
  "realme",
  "nokia",
  "nothing",
  "sony",
  "lg",
  "bose",
  "jbl",
  "sennheiser",
  "boat",
  "boult",
  "noise",
  "marshall",
  "skullcandy",
  "hp",
  "dell",
  "lenovo",
  "asus",
  "acer",
  "msi",
  "canon",
  "nikon",
  "philips",
  "panasonic",
  "lloyd",
  "haier",
  "whirlpool",
  "godrej",
  "voltas",
  "tcl",
  "oneplus"
];

const KNOWN_COLORS = [
  "midnight",
  "silver",
  "space gray",
  "gold",
  "rose gold",
  "black",
  "white",
  "blue",
  "red",
  "green",
  "purple",
  "graphite",
  "titanium"
];

/**
 * Title similarity is recall-oriented: what fraction of the *original* product's
 * meaningful words appear in the candidate title. Retailer titles are far more
 * verbose than Amazon's, so dividing by the longer title (the old behaviour)
 * unfairly punished correct matches — a perfect match buried in marketing copy
 * should still score ~1.
 */
const TITLE_SIMILARITY_WEIGHT = 0.8;
const ATTRIBUTE_MATCH_WEIGHT = 0.2;

/** Filler words that carry no matching signal. */
const STOPWORDS = new Set([
  "with",
  "and",
  "the",
  "for",
  "of",
  "in",
  "on",
  "a",
  "an",
  "to",
  "by",
  "new",
  "latest",
  "buy",
  "online",
  "best",
  "price",
  "india"
]);

/**
 * Extracts structured product attributes from a title.
 * Example: "Apple MacBook Air M4 16GB RAM 512GB SSD Midnight"
 * Output: { brand: "Apple", model: "MacBook Air M4", ram: "16GB", storage: "512GB", color: "Midnight" }
 */
export function extractProductAttributes(title: string): ProductAttributes {
  const attributes: ProductAttributes = {};
  const titleLower = title.toLowerCase();

  for (const brand of KNOWN_BRANDS) {
    if (new RegExp(`\\b${brand}\\b`).test(titleLower)) {
      attributes.brand = brand.charAt(0).toUpperCase() + brand.slice(1);
      break;
    }
  }

  const ramMatch = title.match(/(\d+)\s*GB\s*RAM/i);
  if (ramMatch) {
    attributes.ram = `${ramMatch[1]}GB`;
  }

  // Storage = the largest GB/TB capacity that isn't a RAM figure. Picking the
  // largest avoids mistaking "8GB RAM" for storage in "8GB RAM, 256GB".
  const storageCandidates = [...title.matchAll(/(\d+)\s*(GB|TB)(?!\s*RAM)/gi)].map((match) => ({
    label: `${match[1]}${match[2].toUpperCase()}`,
    sizeGb: Number(match[1]) * (match[2].toUpperCase() === "TB" ? 1024 : 1)
  }));
  if (storageCandidates.length > 0) {
    attributes.storage = storageCandidates.sort((a, b) => b.sizeGb - a.sizeGb)[0].label;
  }

  for (const color of KNOWN_COLORS) {
    if (titleLower.includes(color)) {
      attributes.color = color.charAt(0).toUpperCase() + color.slice(1);
      break;
    }
  }

  return attributes;
}

/** Lowercases, strips punctuation, and drops filler/short tokens. */
function tokenize(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

/** Tokens carrying a digit are model identifiers ("1000xm5", "ch520", "141", "15", "128gb"). */
function isModelToken(token: string): boolean {
  return token.length >= 2 && /\d/.test(token);
}

/** True if `token` is present in `candidates`, exact or (for longer tokens) as a substring. */
function tokenPresent(token: string, candidateSet: Set<string>, candidateTokens: string[]): boolean {
  if (candidateSet.has(token)) return true;
  return (
    token.length >= 4 &&
    candidateTokens.some((c) => c.includes(token) || (c.length >= 4 && token.includes(c)))
  );
}

/**
 * Title similarity (0-1), driven mainly by the model number. Model tokens
 * (anything with a digit, e.g. "1000xm5") are the real product identifier — a
 * candidate missing them is almost certainly a different model even if the rest
 * of the words line up — so when the original has a model token we weight model
 * recall and word recall equally. Without a model token we fall back to word
 * recall. Longer tokens also match as substrings so "headphone"/"headphones"
 * and "wh-1000xm5"/"wh1000xm5" don't miss.
 */
export function calculateTitleSimilarity(original: string, candidate: string): number {
  const originalTokens = tokenize(original);
  if (originalTokens.length === 0) return 0;

  const candidateTokens = tokenize(candidate);
  const candidateSet = new Set(candidateTokens);

  const present = (token: string) => tokenPresent(token, candidateSet, candidateTokens);

  const wordRecall = originalTokens.filter(present).length / originalTokens.length;

  const modelTokens = originalTokens.filter(isModelToken);
  if (modelTokens.length === 0) return wordRecall;

  const modelRecall = modelTokens.filter(present).length / modelTokens.length;
  return 0.5 * modelRecall + 0.5 * wordRecall;
}

/**
 * Compares product attributes and returns a match ratio (0-1). Returns a
 * neutral 0.5 when the original has no extractable attributes, so a thin title
 * never drags the overall score down.
 */
export function compareAttributes(attr1: ProductAttributes, attr2: ProductAttributes): number {
  const keys = (Object.keys(attr1) as (keyof ProductAttributes)[]).filter((k) => attr1[k]);
  if (keys.length === 0) return 0.5;

  let matches = 0;
  for (const key of keys) {
    if (attr1[key] === attr2[key]) matches++;
  }
  return matches / keys.length;
}

/**
 * Matches a search result against the original product and returns a confidence
 * score (0-1), driven mainly by title overlap.
 */
export function matchProduct(
  originalTitle: string,
  searchResultTitle: string,
  originalAttributes: ProductAttributes,
  searchAttributes: ProductAttributes
): number {
  const titleSim = calculateTitleSimilarity(originalTitle, searchResultTitle);
  const attrScore = compareAttributes(originalAttributes, searchAttributes);

  return titleSim * TITLE_SIMILARITY_WEIGHT + attrScore * ATTRIBUTE_MATCH_WEIGHT;
}

/** Attributes that define a *variant* (same product, different SKU). */
const VARIANT_KEYS: (keyof ProductAttributes)[] = ["storage", "ram", "color"];

/**
 * True when two titles describe the same product in a *different* variant —
 * i.e. they conflict on a variant attribute (storage/RAM/colour) that both
 * titles actually specify. Conservative: a missing attribute is never a
 * conflict, so this only fires on a clear difference.
 */
export function variantDiffers(originalTitle: string, candidateTitle: string): boolean {
  const original = extractProductAttributes(originalTitle);
  const candidate = extractProductAttributes(candidateTitle);
  return VARIANT_KEYS.some((key) => original[key] && candidate[key] && original[key] !== candidate[key]);
}

/**
 * Converts a price string to a number.
 * Example: "₹54,999" -> 54999
 */
export function parsePrice(priceStr?: string): number | undefined {
  if (!priceStr) return undefined;
  const cleaned = priceStr.replace(/[^\d.]/g, "");
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : undefined;
}
