import type { Diet } from "../../shared/utils/diet";
import type {
  ShoppingListBuild,
  ShoppingListIngredient,
  ShoppingListRecipe,
  ShoppingListSlot,
  ShoppingListSwaps,
} from "../../shared/utils/shoppingList.types";

// The plan and its list's versions, read together by the signed-in user's own client in one request, so row level
// security decides whether they may open it and the version belongs to the slots and participants read with it.
export interface StoredShoppingPlan {
  id: string;
  includeSnacks: boolean;
  snacksOnList: boolean;
  slots: ShoppingListSlot[];
  participantIds: string[];
  sourceVersion: number;
  generatedVersion: number;
}

// Where a shopping list build's inputs come from and where the list goes. The service depends on this interface
// only, so it is tested with an in-memory store. Everything is read and written as the signed-in user.
export interface ShoppingListStore {
  // Null when the plan does not exist or the signed-in user cannot open it.
  loadPlan(planId: string): Promise<StoredShoppingPlan | null>;
  // User id → diet. Participants' profiles are readable by whoever can open the plan (the owner, or the household).
  loadDiets(userIds: readonly string[]): Promise<Map<string, Diet>>;
  loadRecipes(recipeIds: readonly string[]): Promise<Map<string, ShoppingListRecipe>>;
  // Ready swaps of these recipes for these diets.
  loadSwaps(recipeIds: readonly string[], diets: readonly Diet[]): Promise<ShoppingListSwaps>;
  loadAliases(): Promise<Map<string, ShoppingListIngredient>>;
  // "list-changed" when the plan changed after basedOnVersion was read; nothing is written then.
  applyList(planId: string, basedOnVersion: number, build: ShoppingListBuild): Promise<"applied" | "list-changed">;
}
