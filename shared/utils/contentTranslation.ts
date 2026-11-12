/*
 * Translated recipe content (X1b). Recipes, their ingredient lines, canonical ingredients and tips have one
 * translation row per language (recipe_translations, recipe_ingredient_translations, ingredient_translations,
 * tip_translations). The screens read every language's row at once and pick the active language's here, so switching
 * the language (X1a) changes the content at once, without asking the database again. Lithuanian is the source
 * language: every item has its Lithuanian row (a trigger keeps it in step with the source text), so a missing
 * translation falls back to it.
 */

// The language recipe content is written in, and the fallback for a missing translation. The translation tables allow
// the app's languages (nuxt.config.ts): their *_locale_supported checks list 'lt' and 'en'.
export const CONTENT_SOURCE_LOCALE = "lt";

// The row in the active language, else the Lithuanian one; undefined only when neither exists.
export function pickTranslation<T extends { locale: string }>(translations: readonly T[], locale: string): T | undefined {
  return (
    translations.find((translation) => translation.locale === locale) ??
    translations.find((translation) => translation.locale === CONTENT_SOURCE_LOCALE)
  );
}
