import { z } from "zod";
import type { Diet } from "#shared/utils/diet";
import type { CompleteNutrition } from "#shared/utils/nutrition.types";

// Read only once the user asks for nutrition (F1): the recipe list and detail never select these columns.
export const RECIPE_NUTRITION_COLUMNS = "id, calories_kcal, carbohydrates, protein, fat";
// The estimates of ready protein swaps (D2); row level security returns ready swaps only.
export const SWAP_NUTRITION_COLUMNS = "recipe_id, diet, calories_kcal, carbohydrates, protein, fat";

// numeric(7, 2) columns; PostgREST sends them as JSON numbers.
const nullableNumber = z.number().nonnegative().nullable();

export const recipeNutritionRowsSchema = z
  .array(
    z.object({
      id: z.guid(),
      calories_kcal: nullableNumber,
      carbohydrates: nullableNumber,
      protein: nullableNumber,
      fat: nullableNumber,
    }),
  )
  .transform((rows) =>
    Object.fromEntries(
      rows.map((row) => [
        row.id,
        {
          caloriesKcal: row.calories_kcal,
          carbohydrates: row.carbohydrates,
          protein: row.protein,
          fat: row.fat,
        },
      ]),
    ),
  );

// Recipe id → diet → the swap's estimate. A swap whose estimate was dropped (D2) is left out, so the meal falls back
// to the recipe's own macros.
export const swapNutritionRowsSchema = z
  .array(
    z.object({
      recipe_id: z.guid(),
      diet: z.enum(DIETS),
      calories_kcal: nullableNumber,
      carbohydrates: nullableNumber,
      protein: nullableNumber,
      fat: nullableNumber,
    }),
  )
  .transform((rows) => {
    const byRecipe: Record<string, Partial<Record<Diet, CompleteNutrition>>> = {};
    for (const row of rows) {
      const nutrition = {
        caloriesKcal: row.calories_kcal,
        carbohydrates: row.carbohydrates,
        protein: row.protein,
        fat: row.fat,
      };
      if (isNutritionComplete(nutrition)) {
        byRecipe[row.recipe_id] = { ...byRecipe[row.recipe_id], [row.diet]: nutrition };
      }
    }
    return byRecipe;
  });
