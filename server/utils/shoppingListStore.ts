/*
 * Where a shopping list build reads its inputs and writes the list (G2). Everything goes through the signed-in user's
 * own client: row level security decides which plan they may open and whose diets they may read, and
 * apply_shopping_list_generation() checks access again before it writes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Diet } from "../../shared/utils/diet";
import { fetchAllPages } from "../../shared/utils/fetchAllPages";
import type { Page } from "../../shared/utils/fetchAllPages";
import { DEFAULT_SWAP_LOCALE } from "../../shared/utils/proteinSwap";
import type { ShoppingListSwapItem } from "../../shared/utils/shoppingList.types";
import {
  SHOPPING_ALIAS_COLUMNS,
  SHOPPING_PLAN_COLUMNS,
  SHOPPING_RECIPE_COLUMNS,
  SHOPPING_SWAP_COLUMNS,
  aliasRowSchema,
  dietRowsSchema,
  shoppingPlanRowSchema,
  shoppingRecipeRowsSchema,
  shoppingSwapRowsSchema,
} from "./shoppingList.schema";
import type { ShoppingListStore } from "./shoppingListStore.types";

// Supabase answers at most 1000 rows per request (silently), so the aliases are read in pages.
const PAGE_SIZE = 1000;

export function createSupabaseShoppingListStore(userClient: SupabaseClient): ShoppingListStore {
  return {
    async loadPlan(planId) {
      const { data, error } = await userClient.from("meal_plans").select(SHOPPING_PLAN_COLUMNS).eq("id", planId).maybeSingle();
      if (error) throw new Error(`Loading plan ${planId} for its shopping list failed: ${error.message}`);
      return data ? shoppingPlanRowSchema.parse(data) : null;
    },

    async loadDiets(userIds) {
      const { data, error } = await userClient.from("profiles").select("id, diet").in("id", [...userIds]);
      if (error) throw new Error(`Loading the participants' diets failed: ${error.message}`);
      return new Map(dietRowsSchema.parse(data).map((row) => [row.id, row.diet]));
    },

    async loadRecipes(recipeIds) {
      const { data, error } = await userClient.from("recipes").select(SHOPPING_RECIPE_COLUMNS).in("id", [...recipeIds]);
      if (error) throw new Error(`Loading the plan's recipes failed: ${error.message}`);
      return new Map(shoppingRecipeRowsSchema.parse(data).map((recipe) => [recipe.id, recipe]));
    },

    async loadSwaps(recipeIds, diets) {
      // Row level security shows ready swaps only; the filter says so too.
      const { data, error } = await userClient
        .from("recipe_protein_swaps")
        .select(SHOPPING_SWAP_COLUMNS)
        .eq("status", "ready")
        .eq("locale", DEFAULT_SWAP_LOCALE)
        .in("recipe_id", [...recipeIds])
        .in("diet", [...diets]);
      if (error) throw new Error(`Loading the protein swaps failed: ${error.message}`);

      const swaps = new Map<string, Map<Diet, Map<string, ShoppingListSwapItem>>>();
      for (const row of shoppingSwapRowsSchema.parse(data)) {
        const byDiet = swaps.get(row.recipe_id) ?? new Map<Diet, Map<string, ShoppingListSwapItem>>();
        byDiet.set(
          row.diet,
          new Map(
            row.recipe_protein_swap_items.map((item) => [
              item.recipe_ingredient_id,
              { item: item.item, amount: item.amount, unit: item.unit },
            ]),
          ),
        );
        swaps.set(row.recipe_id, byDiet);
      }
      return swaps;
    },

    async loadAliases() {
      const fetchPage = async (from: number, to: number): Promise<Page<unknown>> => {
        const { data, error, count } = await userClient
          .from("ingredient_aliases")
          .select(SHOPPING_ALIAS_COLUMNS, { count: "exact" })
          .order("item")
          .range(from, to);
        if (error) throw new Error(`Loading the ingredient aliases failed: ${error.message}`);
        return { rows: data ?? [], total: count };
      };
      const rows = await fetchAllPages(fetchPage, PAGE_SIZE);
      return new Map(rows.map((row) => aliasRowSchema.parse(row)));
    },

    async applyList(planId, basedOnVersion, build) {
      const { error } = await userClient.rpc("apply_shopping_list_generation", {
        target_plan_id: planId,
        based_on_version: basedOnVersion,
        items: build.items.map((item) => ({
          key: item.key,
          ingredient_id: item.ingredientId,
          name: item.name,
          category: item.category,
          amount: item.amount,
          unit: item.unit,
          is_extra: item.isExtra,
          swapped_for: item.swappedFor,
        })),
        missing_swaps: build.missingSwapCount,
      });
      if (error?.message === "list_changed") return "list-changed";
      if (error) throw new Error(`Saving the shopping list of ${planId} failed: ${error.message}`);
      return "applied";
    },
  };
}
