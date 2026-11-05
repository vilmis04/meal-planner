/*
 * Showing a protein swap on a recipe (D3). Pure, so the rules are unit tested: whether a recipe needs a swap
 * for a diet, and how a ready swap changes the ingredient list.
 */
import { isRecipeCompatible } from "./diet";
import type { Diet, Protein } from "./diet";
import type { IngredientLine, SwapReplacement, SwappedIngredientLine } from "./recipeSwap.types";

// A swap is asked for only when the diet excludes one of the recipe's main proteins. No diet known: nothing to swap.
export function swapNeeded(diet: Diet | null | undefined, mainProteins: readonly Protein[]): boolean {
  if (!diet) return false;
  return !isRecipeCompatible(diet, mainProteins);
}

// The recipe's ingredients with each replaced line swapped in place, in the recipe's own order.
export function applySwap(
  ingredients: readonly IngredientLine[],
  replacements: readonly SwapReplacement[],
): SwappedIngredientLine[] {
  const byPosition = new Map(replacements.map((replacement) => [replacement.position, replacement]));
  return ingredients.map((ingredient) => {
    const replacement = byPosition.get(ingredient.position);
    if (!replacement) {
      return { ...ingredient, swapped: false, original: null };
    }
    return {
      position: ingredient.position,
      item: replacement.item,
      amount: replacement.amount,
      unit: replacement.unit,
      swapped: true,
      original: { item: ingredient.item, amount: ingredient.amount, unit: ingredient.unit },
    };
  });
}

// True when the replacement keeps the original amount and unit, so the card can say "same amount".
export function keepsAmount(replacement: SwapReplacement): boolean {
  return (
    replacement.amount !== null &&
    replacement.amount === replacement.original.amount &&
    replacement.unit === replacement.original.unit
  );
}

const DEFAULT_RETRY_MS = 3000;
const MIN_RETRY_MS = 1000;
const MAX_RETRY_MS = 10_000;

// How long to wait before asking again for a swap that is being generated, from the Retry-After header (seconds).
export function retryDelayMs(retryAfter: string | null | undefined): number {
  const seconds = Number(retryAfter);
  if (!retryAfter || !Number.isFinite(seconds)) return DEFAULT_RETRY_MS;
  return Math.min(MAX_RETRY_MS, Math.max(MIN_RETRY_MS, seconds * 1000));
}
