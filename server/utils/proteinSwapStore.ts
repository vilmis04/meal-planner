/*
 * Where protein swaps are read and written: recipe_protein_swaps and its items, through a service-role
 * Supabase client (it reads rows RLS hides from users: pending and failed). The service depends on the
 * SwapStore interface only, so its logic is tested with an in-memory store.
 * Imports are explicit so the backfill script can run it too.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { PROMPT_VERSION } from "../../shared/utils/proteinSwap";
import { recipeLineTranslationRowsSchema, storedSwapRowSchema, swapRecipeRowSchema } from "./proteinSwapStore.schema";
import type { SwapKey, SwapStore } from "./proteinSwapStore.types";

const RECIPE_COLUMNS =
  "id, name, main_proteins, calories_kcal, carbohydrates, protein, fat, recipe_ingredients(id, position, item, amount, unit)";
const SWAP_COLUMNS =
  "status, claimed_at, retry_after, attempts, source_hash, prompt_version, note, calories_kcal, carbohydrates, " +
  "protein, fat, generated_at, recipe_protein_swap_translations(locale, note), " +
  "recipe_protein_swap_items(recipe_ingredient_id, item, amount, unit, replacement_protein, " +
  "recipe_protein_swap_item_translations(locale, item))";

const describeKey = (key: SwapKey) => `${key.recipeId}/${key.diet}/${key.locale}`;

export function createSupabaseSwapStore(db: SupabaseClient): SwapStore {
  return {
    async loadRecipe(recipeId) {
      const { data, error } = await db.from("recipes").select(RECIPE_COLUMNS).eq("id", recipeId).maybeSingle();
      if (error) throw new Error(`Loading recipe ${recipeId} failed: ${error.message}`);
      return data ? swapRecipeRowSchema.parse(data) : null;
    },

    async loadRecipeLineTranslations(recipeId, locale) {
      const { data, error } = await db
        .from("recipe_ingredient_translations")
        .select("recipe_ingredient_id, item, recipe_ingredients!inner(recipe_id)")
        .eq("recipe_ingredients.recipe_id", recipeId)
        .eq("locale", locale);
      if (error) throw new Error(`Loading the ${locale} lines of recipe ${recipeId} failed: ${error.message}`);
      return recipeLineTranslationRowsSchema.parse(data);
    },

    async loadSwap(key) {
      const { data, error } = await db
        .from("recipe_protein_swaps")
        .select(SWAP_COLUMNS)
        .eq("recipe_id", key.recipeId)
        .eq("diet", key.diet)
        .eq("locale", key.locale)
        .maybeSingle();
      if (error) throw new Error(`Loading the swap ${describeKey(key)} failed: ${error.message}`);
      return data ? storedSwapRowSchema.parse(data) : null;
    },

    async claim(key, sourceHash) {
      const { data, error } = await db.rpc("claim_recipe_protein_swap", {
        p_recipe_id: key.recipeId,
        p_diet: key.diet,
        p_locale: key.locale,
        p_source_hash: sourceHash,
        p_prompt_version: PROMPT_VERSION,
      });
      if (error) throw new Error(`Claiming the swap ${describeKey(key)} failed: ${error.message}`);
      return data === true;
    },

    async save(key, swap, sourceHash, model) {
      const { error } = await db.rpc("save_recipe_protein_swap", {
        p_swap: {
          recipe_id: key.recipeId,
          diet: key.diet,
          locale: key.locale,
          note: swap.note,
          calories_kcal: swap.nutrition?.caloriesKcal ?? null,
          carbohydrates: swap.nutrition?.carbohydrates ?? null,
          protein: swap.nutrition?.protein ?? null,
          fat: swap.nutrition?.fat ?? null,
          source_hash: sourceHash,
          model,
          prompt_version: PROMPT_VERSION,
          items: swap.items.map((item) => ({
            recipe_ingredient_id: item.recipeIngredientId,
            original_protein: item.originalProtein,
            item: item.item,
            amount: item.amount,
            unit: item.unit,
            replacement_protein: item.replacementProtein,
          })),
        },
      });
      if (error) throw new Error(`Saving the swap ${describeKey(key)} failed: ${error.message}`);
    },

    async saveTranslation(key, translation) {
      const { error } = await db.rpc("save_recipe_protein_swap_translation", {
        p_translation: {
          recipe_id: key.recipeId,
          diet: key.diet,
          locale: key.locale,
          translation_locale: translation.locale,
          source_note: translation.sourceNote,
          note: translation.note,
          items: translation.items.map((item) => ({
            recipe_ingredient_id: item.recipeIngredientId,
            source_item: item.sourceItem,
            item: item.item,
          })),
        },
      });
      if (error) throw new Error(`Saving the ${translation.locale} swap ${describeKey(key)} failed: ${error.message}`);
    },

    async markFailed(key, attempts, message, retryAfter) {
      const { error } = await db
        .from("recipe_protein_swaps")
        .update({
          status: "failed",
          claimed_at: null,
          attempts,
          last_error: message.slice(0, 1000),
          retry_after: retryAfter.toISOString(),
        })
        .eq("recipe_id", key.recipeId)
        .eq("diet", key.diet)
        .eq("locale", key.locale)
        .eq("status", "pending");
      if (error) throw new Error(`Marking the swap ${describeKey(key)} failed: ${error.message}`);
    },
  };
}
