/*
 * Rows of recipes, recipe_protein_swaps and their translations as the service-role Supabase client returns them, parsed into the
 * shapes the swap service works with.
 */
import { z } from "zod";
import { PROTEINS } from "../../shared/utils/diet";
import type { SwapRecipe } from "../../shared/utils/proteinSwap.types";
import type { StoredSwap } from "./proteinSwapStore.types";

const nullableNumber = z.number().nullable();
const proteinSchema = z.enum(PROTEINS);
const timestamp = z
  .string()
  .nullable()
  .transform((value) => (value === null ? null : new Date(value)));

export const swapRecipeRowSchema = z
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

// recipe_ingredient_translations rows of one recipe and language (X1b), by ingredient id.
export const recipeLineTranslationRowsSchema = z
  .array(z.object({ recipe_ingredient_id: z.string(), item: z.string() }))
  .transform((rows) => new Map(rows.map((row) => [row.recipe_ingredient_id, row.item])));

export const storedSwapRowSchema = z
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
    recipe_protein_swap_translations: z.array(z.object({ locale: z.string(), note: z.string().nullable() })),
    recipe_protein_swap_items: z.array(
      z.object({
        recipe_ingredient_id: z.string(),
        item: z.string(),
        amount: nullableNumber,
        unit: z.string().nullable(),
        replacement_protein: proteinSchema,
        recipe_protein_swap_item_translations: z.array(z.object({ locale: z.string(), item: z.string() })),
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
      translations: row.recipe_protein_swap_translations,
      items: row.recipe_protein_swap_items.map((item) => ({
        recipeIngredientId: item.recipe_ingredient_id,
        item: item.item,
        texts: item.recipe_protein_swap_item_translations,
        amount: item.amount,
        unit: item.unit,
        replacementProtein: item.replacement_protein,
      })),
    }),
  );
