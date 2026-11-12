/*
 * Showing a protein swap on a recipe (D3). Pure, so the rules are unit tested: whether a recipe needs a swap
 * for a diet, how a ready swap changes the ingredient list, and the swap in the viewer's language (X1c).
 */
import { pickTranslation } from "./contentTranslation";
import { isRecipeCompatible } from "./diet";
import type { Diet, Protein } from "./diet";
import type { ProteinSwapView } from "./proteinSwap.types";
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

/*
 * A stored swap in the viewer's language (X1c): each replacement's item and the note from the swap's translations,
 * falling back to Lithuanian, and each original named as the (already localized) recipe names that line. Amounts and
 * units stay as stored; the unit labels translate them.
 */
export function localizeSwap(
  swap: ProteinSwapView,
  ingredients: readonly IngredientLine[],
  locale: string,
): ProteinSwapView {
  const byPosition = new Map(ingredients.map((ingredient) => [ingredient.position, ingredient]));
  const note = pickTranslation(swap.notes, locale);
  return {
    ...swap,
    note: note === undefined ? swap.note : note.note,
    items: swap.items.map((item) => ({
      ...item,
      item: pickTranslation(item.texts, locale)?.item ?? item.item,
      original: { ...item.original, item: byPosition.get(item.position)?.item ?? item.original.item },
    })),
  };
}
