import { z } from "zod";

// Nutrition columns (calories_kcal, carbohydrates, protein, fat) are left out on purpose: they stay hidden until F1.
export const RECIPE_LIST_COLUMNS = "id, name, meal_type, portion_days";
export const RECIPE_DETAIL_COLUMNS =
  "id, name, meal_type, instructions, portion_days, recipe_ingredients(position, item, amount, unit)";

// MEAL_TYPES is in shared/utils/mealFilter.ts and matches the public.meal_type enum.
const mealTypeSchema = z.enum(MEAL_TYPES);

export const recipeListRowsSchema = z
  .array(
    z.object({
      id: z.guid(),
      name: z.string(),
      meal_type: mealTypeSchema,
      portion_days: z.number().int().min(1),
    }),
  )
  .transform((rows) =>
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      mealType: row.meal_type,
      portionDays: row.portion_days,
    })),
  );

// amount and unit are both null for "to taste" items (the recipe_ingredients_amount_unit_together constraint).
const ingredientRowSchema = z.object({
  position: z.number().int(),
  item: z.string(),
  amount: z.number().nullable(),
  unit: z.string().nullable(),
});

export const recipeDetailRowSchema = z
  .object({
    id: z.guid(),
    name: z.string(),
    meal_type: mealTypeSchema,
    instructions: z.string(),
    portion_days: z.number().int().min(1),
    recipe_ingredients: z.array(ingredientRowSchema),
  })
  .transform((row) => ({
    id: row.id,
    name: row.name,
    mealType: row.meal_type,
    instructions: row.instructions.trim(),
    portionDays: row.portion_days,
    // The embedded rows come back in no promised order; position is the order the recipe lists them in.
    ingredients: [...row.recipe_ingredients]
      .sort((a, b) => a.position - b.position)
      .map((ingredient) => ({ item: ingredient.item, amount: ingredient.amount, unit: ingredient.unit })),
  }));

export const recipeIdSchema = z.guid();
