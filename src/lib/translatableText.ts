/**
 * UI copy that has to live outside a component, and the placeholder substitution the translation
 * function performs on it.
 *
 * Two of the board's modules — `swimlanes.ts` and `boardFilters.ts` — are deliberately hook-free pure
 * functions, so they cannot resolve their own copy (that purity is what makes them the ADR-0008
 * drop-in seam and what makes them testable). They carry {@link TranslatableText} instead: the key
 * plus the English it falls back to, which the rendering component resolves through
 * {@link resolveText}.
 *
 * The same type also carries copy that must *not* be translated — a member's display name, an epic
 * key — as an unkeyed text, so a caller never has to decide per call site whether a string is UI copy
 * or catalog data.
 */

/** Values substituted into a sentence's `{name}` placeholders. */
export type TranslationValues = Record<string, string | number>

/** The `t` from `useLanguage`, as a plain type, so pure modules can be handed one. */
export type Translate = (key: string, fallback: string, values?: TranslationValues) => string

export interface TranslatableText {
  /** Translation key, or `null` when the text is catalog or user data and must render verbatim. */
  key: string | null
  /** The English copy — a fallback for keyed text, the whole story for unkeyed text. */
  text: string
}

const PLACEHOLDER_PATTERN = /\{(\w+)\}/g

/**
 * Substitute `{name}` placeholders in `template`.
 *
 * A placeholder with no matching value is left exactly as written rather than blanked, so a
 * translation that misspells a placeholder reads as an obvious defect instead of a hole in the
 * sentence.
 */
export function interpolate(template: string, values: TranslationValues): string {
  return template.replace(PLACEHOLDER_PATTERN, (placeholder, name: string) =>
    values[name] !== undefined ? String(values[name]) : placeholder,
  )
}

/** Resolve module-owned copy: keyed text goes through the translation function, data renders as it came. */
export function resolveText(translate: Translate, text: TranslatableText): string {
  if (text.key === null) {
    return text.text
  }

  return translate(text.key, text.text)
}
