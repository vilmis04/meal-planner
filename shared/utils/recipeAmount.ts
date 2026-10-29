/*
 * How an ingredient amount reads on screen.
 *
 * recipe_ingredients.amount is numeric(8, 2) and null for "to taste" items (spices, salt, fresh herbs), so the
 * database hands over 2, 0.5 or 12.5 and never needs more than two decimals. Numbers follow the active locale
 * (0.5 in English, 0,5 in Lithuanian), as the i18n story asks.
 */

const MAX_FRACTION_DIGITS = 2;

// Null means "to taste": the caller shows its own translated label instead of a number.
export function formatAmount(amount: number | null, locale: string): string | null {
  if (amount === null) {
    return null;
  }

  return new Intl.NumberFormat(locale, { maximumFractionDigits: MAX_FRACTION_DIGITS }).format(amount);
}
