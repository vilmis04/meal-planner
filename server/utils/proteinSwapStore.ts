/*
 * Where protein swaps are read and written: recipe_protein_swaps and its items, through a service-role
 * Supabase client (it reads rows RLS hides from users: pending and failed). The service depends on the
 * SwapStore interface only, so its logic is tested with an in-memory store.
 * Imports are explicit so the backfill script can run it too.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { PROTEINS } from "../../shared/utils/diet";
import type { Diet, Protein } from "../../shared/utils/diet";
import { PROMPT_VERSION } from "../../shared/utils/proteinSwap";
import type { SwapLocale, SwapRecipe, SwapStatus, ValidatedSwap } from "../../shared/utils/proteinSwap";

export interface StoredSwap {
  status: SwapStatus;
  claimedAt: Date | null;
  retryAfter: Date | null;
  attempts: number;
  sourceHash: string | null;
  promptVersion: number | null;
  note: string | null;
  caloriesKcal: number | null;
  carbohydrates: number | null;
  protein: number | null;
  fat: number | null;
  generatedAt: Date | null;
  items: {
    recipeIngredientId: string;
    item: string;
    amount: number | null;
    unit: string | null;
    replacementProtein: Protein;
  }[];
}

export interface SwapKey {
  recipeId: string;
  diet: Diet;
  locale: SwapLocale;
}

export interface SwapStore {
  loadRecipe(recipeId: string): Promise<SwapRecipe | null>;
  loadSwap(key: SwapKey): Promise<StoredSwap | null>;
  // True for the one caller that may generate the pair now (claim_recipe_protein_swap).
  claim(key: SwapKey, sourceHash: string): Promise<boolean>;
  // Saves a claimed pair as ready with its items (save_recipe_protein_swap).
  save(key: SwapKey, swap: ValidatedSwap, sourceHash: string, model: string): Promise<void>;
  // Releases a claimed pair as failed until retryAfter.
  markFailed(key: SwapKey, attempts: number, error: string, retryAfter: Date): Promise<void>;
}

const RECIPE_COLUMNS =
  "id, name, main_proteins, calories_kcal, carbohydrates, protein, fat, recipe_ingredients(id, position, item, amount, unit)";
const SWAP_COLUMNS =
  "status, claimed_at, retry_after, attempts, source_hash, prompt_version, note, calories_kcal, carbohydrates, " +
  "protein, fat, generated_at, recipe_protein_swap_items(recipe_ingredient_id, item, amount, unit, replacement_protein)";

const nullableNumber = z.number().nullable();
const proteinSchema = z.enum(PROTEINS);
const timestamp = z
  .string()
  .nullable()
  .transform((value) => (value === null ? null : new Date(value)));

const recipeRowSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    main_proteins: z.array(proteinSchema),
    calories_kcal: nullableNumber,
    carbohydrates: nullableNumber,
    protein: nullableNumber,
    fat: nullableNumber,
    recipe_ingredients: z.array(
      z.object({
        id: z.string(),
        position: z.number().int(),
        item: z.string(),
        amount: nullableNumber,
        unit: z.string().nullable(),
      }),
    ),
  })
  .transform(
    (row): SwapRecipe => ({
      id: row.id,
      name: row.name,
      mainProteins: row.main_proteins,
      ingredients: [...row.recipe_ingredients].sort((a, b) => a.position - b.position),
      nutrition: {
        caloriesKcal: row.calories_kcal,
        carbohydrates: row.carbohydrates,
        protein: row.protein,
        fat: row.fat,
      },
    }),
  );

const swapRowSchema = z
  .object({
    status: z.enum(["pending", "ready", "failed", "rejected"]),
    claimed_at: timestamp,
    retry_after: timestamp,
    attempts: z.number().int(),
    source_hash: z.string().nullable(),
    prompt_version: z.number().int().nullable(),
    note: z.string().nullable(),
    calories_kcal: nullableNumber,
    carbohydrates: nullableNumber,
    protein: nullableNumber,
    fat: nullableNumber,
    generated_at: timestamp,
    recipe_protein_swap_items: z.array(
      z.object({
        recipe_ingredient_id: z.string(),
        item: z.string(),
        amount: nullableNumber,
        unit: z.string().nullable(),
        replacement_protein: proteinSchema,
      }),
    ),
  })
  .transform(
    (row): StoredSwap => ({
      status: row.status,
      claimedAt: row.claimed_at,
      retryAfter: row.retry_after,
      attempts: row.attempts,
      sourceHash: row.source_hash,
      promptVersion: row.prompt_version,
      note: row.note,
      caloriesKcal: row.calories_kcal,
      carbohydrates: row.carbohydrates,
      protein: row.protein,
      fat: row.fat,
      generatedAt: row.generated_at,
      items: row.recipe_protein_swap_items.map((item) => ({
        recipeIngredientId: item.recipe_ingredient_id,
        item: item.item,
        amount: item.amount,
        unit: item.unit,
        replacementProtein: item.replacement_protein,
      })),
    }),
  );

const describeKey = (key: SwapKey) => `${key.recipeId}/${key.diet}/${key.locale}`;

export function createSupabaseSwapStore(db: SupabaseClient): SwapStore {
  return {
    async loadRecipe(recipeId) {
      const { data, error } = await db.from("recipes").select(RECIPE_COLUMNS).eq("id", recipeId).maybeSingle();
      if (error) throw new Error(`Loading recipe ${recipeId} failed: ${error.message}`);
      return data ? recipeRowSchema.parse(data) : null;
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
      return data ? swapRowSchema.parse(data) : null;
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
