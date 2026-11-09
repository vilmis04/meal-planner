import type { Diet, Protein } from "./diet";
import type { INGREDIENT_CATEGORIES } from "./ingredient";
import type { MealType } from "./mealFilter";
import type { EXTRAS_GROUP_KEY, SHOPPING_ITEM_SOURCES, SHOPPING_ITEM_STATES } from "./shoppingList";

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];
type ShoppingItemState = (typeof SHOPPING_ITEM_STATES)[number];
type ShoppingItemSource = (typeof SHOPPING_ITEM_SOURCES)[number];

export interface ShoppingListSlot {
  mealType: MealType;
  recipeId: string | null;
}

export interface ShoppingListParticipant {
  userId: string;
  diet: Diet;
}

// One line of a recipe, per one person's portion over the recipe's portionDays. amount and unit are null for "to taste".
interface ShoppingListRecipeIngredient {
  id: string;
  item: string;
  amount: number | null;
  unit: string | null;
}

export interface ShoppingListRecipe {
  id: string;
  portionDays: number;
  mainProteins: readonly Protein[];
  ingredients: readonly ShoppingListRecipeIngredient[];
}

// What a ready protein swap puts in place of one recipe ingredient.
export interface ShoppingListSwapItem {
  item: string;
  amount: number | null;
  unit: string | null;
}

// recipe id → diet → recipe ingredient id → its replacement. Ready swaps only.
export type ShoppingListSwaps = ReadonlyMap<string, ReadonlyMap<Diet, ReadonlyMap<string, ShoppingListSwapItem>>>;

// The canonical ingredient an item spelling maps to (G1).
export interface ShoppingListIngredient {
  id: string;
  name: string;
  category: IngredientCategory;
  isOnShoppingList: boolean;
}

export interface ShoppingListInput {
  slots: readonly ShoppingListSlot[];
  includeSnacks: boolean;
  snacksOnList: boolean;
  participants: readonly ShoppingListParticipant[];
  recipes: ReadonlyMap<string, ShoppingListRecipe>;
  swaps: ShoppingListSwaps;
  // Item spelled exactly as written → its ingredient.
  aliases: ReadonlyMap<string, ShoppingListIngredient>;
}

// A line as a build makes it: the generated columns of shopping_items.
export interface GeneratedShoppingItem {
  key: string;
  ingredientId: string | null;
  name: string;
  category: IngredientCategory;
  // In the base unit (g, ml, or a unit counted on its own). Null for a "to taste" line.
  amount: number | null;
  unit: string | null;
  isExtra: boolean;
  // Participants whose protein swap brought this line (or part of it).
  swappedFor: string[];
}

export interface ShoppingListBuild {
  items: GeneratedShoppingItem[];
  // Recipe and diet pairs that needed a protein swap that is not ready, so that share follows the original recipe.
  missingSwapCount: number;
}

// A stored line, as the list page reads it.
export interface ShoppingItem {
  id: string;
  source: ShoppingItemSource;
  name: string;
  category: IngredientCategory;
  amount: number | null;
  unit: string | null;
  isExtra: boolean;
  swappedFor: string[];
  inPlan: boolean;
  state: ShoppingItemState;
  isRemoved: boolean;
  amountOverride: number | null;
}

// A group of the list: a category, or the "to taste" extras. G4 adds "have at home".
export type ShoppingListGroupKey = IngredientCategory | typeof EXTRAS_GROUP_KEY;

interface ShoppingListGroup {
  key: ShoppingListGroupKey;
  items: ShoppingItem[];
  // What the group's header counts: every line shown in it for now; G4 and G5 narrow it to the lines still to buy.
  itemCount: number;
}

// What the list shows: its groups in list order (categories in the order of a walk through a shop, then the extras),
// empty groups left out.
export interface ShoppingListView {
  groups: ShoppingListGroup[];
  itemCount: number;
}
