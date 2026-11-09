import { z } from "zod";

// Nutrition columns (calories_kcal, carbohydrates, protein, fat) are left out on purpose: they are read on their own,
// only once the user asks to see them (RECIPE_NUTRITION_COLUMNS in app/utils/nutrition.ts, F1).
// main_proteins lets the slot picker's "Fits all diets" filter (E6) check each participant's diet.
export const RECIPE_LIST_COLUMNS = "id, name, meal_type, portion_days, main_proteins";
export const RECIPE_DETAIL_COLUMNS =
  "id, name, meal_type, instructions, portion_days, main_proteins, recipe_ingredients(position, item, amount, unit)";

// Rows asked for per request when reading the whole list. Supabase answers at most 1000 per request by default.
export const RECIPE_PAGE_SIZE = 1000;

// MEAL_TYPES is in shared/utils/mealFilter.ts and matches the public.meal_type enum.
const mealTypeSchema = z.enum(MEAL_TYPES);

export const recipeListRowsSchema = z
  .array(
    z.object({
      id: z.guid(),
      name: z.string(),
      meal_type: mealTypeSchema,
      portion_days: z.number().int().min(1),
      main_proteins: z.array(z.enum(PROTEINS)),
    }),
  )
  .transform((rows) =>
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      mealType: row.meal_type,
      portionDays: row.portion_days,
      mainProteins: row.main_proteins,
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
    // PROTEINS is in shared/utils/diet.ts and matches the recipes_main_proteins_supported constraint (D1).
    main_proteins: z.array(z.enum(PROTEINS)),
    recipe_ingredients: z.array(ingredientRowSchema),
  })
  .transform((row) => ({
    id: row.id,
    name: row.name,
    mealType: row.meal_type,
    instructions: row.instructions.trim(),
    portionDays: row.portion_days,
    mainProteins: row.main_proteins,
    // The embedded rows come back in no promised order; position is the order the recipe lists them in, and
    // what a protein swap (D3) names the ingredient it replaces by.
    ingredients: [...row.recipe_ingredients]
      .sort((a, b) => a.position - b.position)
      .map((ingredient) => ({
        position: ingredient.position,
        item: ingredient.item,
        amount: ingredient.amount,
        unit: ingredient.unit,
      })),
  }));

export const recipeIdSchema = z.guid();
