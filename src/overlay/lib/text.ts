// Strips emoji plus the modifiers that combine with them: skin-tone selectors,
// the zero-width joiner, the variation selector, and the keycap mark. ESLint's
// no-misleading-character-class flags these combining code points in a class —
// that's exactly what we want to remove here, so the rule is disabled.
// eslint-disable-next-line no-misleading-character-class
const EMOJI_PATTERN = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{200D}\u{FE0F}\u{20E3}]/gu;

/** Strips emoji characters from text and collapses the whitespace left behind. */
export function stripEmojis(text: string): string {
  return text
    .replace(EMOJI_PATTERN, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
