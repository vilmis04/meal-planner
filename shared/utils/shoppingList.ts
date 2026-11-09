/*
 * Building a plan's shopping list (G2). Pure on purpose: the server builds and stores the list with it, and the
 * tests run it on fixed plans.
 *
 * The rules:
 *   * Every planned slot the plan shows counts, except snacks when the plan skips them or leaves them off the list.
 *   * Recipe amounts are one person's portion over the recipe's portion_days ("Porcija dviems dienoms": a 2-day
 *     recipe's amounts feed one person on both days). Each slot therefore takes 1 / portion_days of the recipe per
 *     participant: a 2-day batch on two slots is cooked once and counted once, for both days; a 2-day recipe placed
 *     on one day only (E3's "Only Tue") is counted for that day, half the recipe. This is the same as counting each
 *     batch of getBatchDays() once, scaled by how many of its days the plan holds.
 *   * Each participant's share follows their diet: a recipe their diet does not allow uses its ready protein swap for
 *     that diet (D2), so chicken for one and cod for another are separate lines. Without a ready swap the share
 *     follows the original recipe and is counted in missingSwapCount.
 *   * Items merge by canonical ingredient (ingredient_aliases, G1) and base unit (toBaseQuantity()): kg and g are one
 *     line, pieces another. An item without an alias is kept under its own spelling, in "other", and merges only with
 *     the same spelling. Ingredients that are never bought (on_shopping_list = false, tap water) are left out.
 *   * "To taste" items are extras without an amount, one per ingredient, unless the ingredient is on the list with an
 *     amount anyway.
 */
import { isRecipeCompatible } from "./diet";
import { INGREDIENT_CATEGORIES } from "./ingredient";
import { toBaseQuantity } from "./ingredientUnit";
import { getPlanServings, getVisibleMealTypes } from "./mealPlan";
import type { Diet } from "./diet";
import type { MealType } from "./mealFilter";
import type {
  GeneratedShoppingItem,
  IngredientCategory,
  ShoppingItem,
  ShoppingListBuild,
  ShoppingListGroupKey,
  ShoppingListIngredient,
  ShoppingListInput,
  ShoppingListRecipe,
  ShoppingListSwapItem,
  ShoppingListView,
} from "./shoppingList.types";

// shopping_items.state and shopping_items.source; the shopping_items_state_supported and
// shopping_items_source_supported checks must match.
export const SHOPPING_ITEM_STATES = ["to_buy", "have_at_home", "bought"] as const;
export const SHOPPING_ITEM_SOURCES = ["generated", "manual"] as const;
// The group of "to taste" lines, after the categories.
export const EXTRAS_GROUP_KEY = "extras";

// Where an item without an alias goes until it is mapped (G1's report lists it).
const UNMAPPED_CATEGORY: IngredientCategory = "other";
// shopping_items.amount is numeric(12, 2).
const AMOUNT_FRACTION_DIGITS = 2;
const SMALLEST_AMOUNT = 0.01;
// Lines are sorted as the recipes are written: Lithuanian, until X1b.
const NAME_COLLATION_LOCALE = "lt";

export function buildShoppingList(input: ShoppingListInput): ShoppingListBuild {
  const listedMealTypes = getListedMealTypes(input.includeSnacks, input.snacksOnList);
  const participants = [...new Map(input.participants.map((participant) => [participant.userId, participant])).values()];
  if (getPlanServings(participants.map((participant) => participant.userId)) === 0) {
    return { items: [], missingSwapCount: 0 };
  }

  const amountLines = new Map<string, LineTotal>();
  const extraLines = new Map<string, LineTotal>();
  const missingSwaps = new Set<string>();

  for (const slot of input.slots) {
    const recipe = slot.recipeId === null ? undefined : input.recipes.get(slot.recipeId);
    if (recipe === undefined || !listedMealTypes.has(slot.mealType)) {
      continue;
    }

    const portionShare = 1 / Math.max(recipe.portionDays, 1);
    for (const participant of participants) {
      const share = getParticipantIngredients(recipe, participant.diet, input.swaps);
      if (share.isSwapMissing) {
        missingSwaps.add(`${recipe.id}|${participant.diet}`);
      }

      for (const ingredient of share.ingredients) {
        const mapped = input.aliases.get(ingredient.item);
        if (mapped !== undefined && !mapped.isOnShoppingList) {
          continue;
        }

        const identity = getLineIdentity(ingredient.item, mapped);
        const swappedFor = ingredient.isSwapped ? participant.userId : null;
        if (ingredient.amount === null || ingredient.unit === null) {
          addToLine(extraLines, `${identity.identityKey}|`, { ...identity, unit: null, amount: 0, swappedFor });
          continue;
        }

        const baseQuantity = toBaseQuantity({ amount: ingredient.amount, unit: ingredient.unit });
        addToLine(amountLines, `${identity.identityKey}|${baseQuantity.unit}`, {
          ...identity,
          unit: baseQuantity.unit,
          amount: baseQuantity.amount * portionShare,
          swappedFor,
        });
      }
    }
  }

  const identitiesWithAmount = new Set([...amountLines.values()].map((line) => line.identityKey));
  const items = [
    ...[...amountLines.entries()].map(([key, line]) => toGeneratedItem(key, line, false)),
    ...[...extraLines.entries()]
      .filter(([, line]) => !identitiesWithAmount.has(line.identityKey))
      .map(([key, line]) => toGeneratedItem(key, line, true)),
  ];
  return { items: items.sort(compareGeneratedItems), missingSwapCount: missingSwaps.size };
}

// The lines the list shows (in the plan and not removed), by category in INGREDIENT_CATEGORIES order (a walk through a
// shop), then the "to taste" extras, without empty groups. Names follow the recipes' language.
export function getShoppingListView(items: readonly ShoppingItem[]): ShoppingListView {
  const shownItems = items
    .filter((item) => item.inPlan && !item.isRemoved)
    .sort((first, second) => compareNames(first.name, second.name));
  const categoryGroups = INGREDIENT_CATEGORIES.map((category) =>
    toGroup(category, shownItems.filter((item) => !item.isExtra && item.category === category)),
  );
  const extrasGroup = toGroup(EXTRAS_GROUP_KEY, shownItems.filter((item) => item.isExtra));
  const groups = [...categoryGroups, extrasGroup].filter((group) => group.items.length > 0);
  return { groups, itemCount: shownItems.length };
}

interface LineIdentity {
  identityKey: string;
  ingredientId: string | null;
  name: string;
  category: IngredientCategory;
}

interface LineContribution extends LineIdentity {
  unit: string | null;
  amount: number;
  swappedFor: string | null;
}

interface LineTotal extends LineIdentity {
  unit: string | null;
  amount: number;
  swappedFor: Set<string>;
}

interface ParticipantIngredient extends ShoppingListSwapItem {
  isSwapped: boolean;
}

interface ParticipantShare {
  ingredients: ParticipantIngredient[];
  isSwapMissing: boolean;
}

const toGroup = (key: ShoppingListGroupKey, groupItems: ShoppingItem[]) => ({
  key,
  items: groupItems,
  itemCount: groupItems.length,
});

const getListedMealTypes = (includeSnacks: boolean, snacksOnList: boolean): Set<MealType> =>
  new Set(getVisibleMealTypes(includeSnacks && snacksOnList));

// The recipe as this diet eats it: as written when the diet allows it, otherwise with its ready swap's replacements.
const getParticipantIngredients = (
  recipe: ShoppingListRecipe,
  diet: Diet,
  swaps: ShoppingListInput["swaps"],
): ParticipantShare => {
  const asWritten = recipe.ingredients.map((ingredient) => ({ ...ingredient, isSwapped: false }));
  if (isRecipeCompatible(diet, recipe.mainProteins)) {
    return { ingredients: asWritten, isSwapMissing: false };
  }

  const replacements = swaps.get(recipe.id)?.get(diet);
  if (replacements === undefined) {
    return { ingredients: asWritten, isSwapMissing: true };
  }

  const ingredients = recipe.ingredients.map((ingredient) => {
    const replacement = replacements.get(ingredient.id);
    return replacement === undefined ? { ...ingredient, isSwapped: false } : { ...replacement, isSwapped: true };
  });
  return { ingredients, isSwapMissing: false };
};

const getLineIdentity = (item: string, mapped: ShoppingListIngredient | undefined): LineIdentity => {
  if (mapped === undefined) {
    return { identityKey: `item:${item}`, ingredientId: null, name: item.trim(), category: UNMAPPED_CATEGORY };
  }
  return { identityKey: `ingredient:${mapped.id}`, ingredientId: mapped.id, name: mapped.name, category: mapped.category };
};

const addToLine = (lines: Map<string, LineTotal>, key: string, contribution: LineContribution): void => {
  const line = lines.get(key) ?? { ...contribution, amount: 0, swappedFor: new Set<string>() };
  line.amount += contribution.amount;
  if (contribution.swappedFor !== null) {
    line.swappedFor.add(contribution.swappedFor);
  }
  lines.set(key, line);
};

const toGeneratedItem = (key: string, line: LineTotal, isExtra: boolean): GeneratedShoppingItem => ({
  key,
  ingredientId: line.ingredientId,
  name: line.name,
  category: line.category,
  amount: isExtra ? null : roundAmount(line.amount),
  unit: isExtra ? null : line.unit,
  isExtra,
  swappedFor: [...line.swappedFor].sort(),
});

const roundAmount = (amount: number): number => {
  const scale = 10 ** AMOUNT_FRACTION_DIGITS;
  return Math.max(Math.round(amount * scale) / scale, SMALLEST_AMOUNT);
};

const compareNames = (first: string, second: string): number =>
  first.localeCompare(second, NAME_COLLATION_LOCALE);

const compareGeneratedItems = (first: GeneratedShoppingItem, second: GeneratedShoppingItem): number =>
  INGREDIENT_CATEGORIES.indexOf(first.category) - INGREDIENT_CATEGORIES.indexOf(second.category) ||
  compareNames(first.name, second.name) ||
  first.key.localeCompare(second.key);
