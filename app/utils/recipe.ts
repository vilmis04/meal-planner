import { z } from "zod";
import { pickTranslation } from "#shared/utils/contentTranslation";
import { PROTEINS } from "#shared/utils/diet";
import { MEAL_TYPES } from "#shared/utils/mealFilter";
import type { Recipe, RecipeContent, RecipeListEntry, RecipeSummary } from "~/types/recipe.types";

// Nutrition columns (calories_kcal, carbohydrates, protein, fat) are left out on purpose: they are read on their own,
// only once the user asks to see them (RECIPE_NUTRITION_COLUMNS in app/utils/nutrition.ts, F1).
// main_proteins lets the slot picker's "Fits all diets" filter (E6) check each participant's diet.
// Names, instructions and items come in every language at once (X1b), so switching the language needs no new read; the
// Lithuanian columns of recipes and recipe_ingredients are the fallback when a recipe has no translation rows yet.
export const RECIPE_LIST_COLUMNS = "id, name, meal_type, portion_days, main_proteins, recipe_translations(locale, name)";
export const RECIPE_DETAIL_COLUMNS =
  "id, name, meal_type, instructions, portion_days, main_proteins, recipe_translations(locale, name, instructions), " +
  "recipe_ingredients(position, item, amount, unit, recipe_ingredient_translations(locale, item, unit))";

// Rows asked for per request when reading the whole list. Supabase answers at most 1000 per request by default.
export const RECIPE_PAGE_SIZE = 1000;

// MEAL_TYPES is in shared/utils/mealFilter.ts and matches the public.meal_type enum.
const mealTypeSchema = z.enum(MEAL_TYPES);

const nameTranslationSchema = z.object({ locale: z.string(), name: z.string() });

export const recipeListRowsSchema = z
  .array(
    z.object({
      id: z.guid(),
      name: z.string(),
      meal_type: mealTypeSchema,
      portion_days: z.number().int().min(1),
      main_proteins: z.array(z.enum(PROTEINS)),
      recipe_translations: z.array(nameTranslationSchema),
    }),
  )
  .transform((rows) =>
    rows.map((row) => ({
      id: row.id,
      sourceName: row.name,
      names: row.recipe_translations,
      mealType: row.meal_type,
      portionDays: row.portion_days,
      mainProteins: row.main_proteins,
    })),
  );

// amount and unit are both null for "to taste" items (the recipe_ingredients_amount_unit_together constraint).
// A translation's unit is set only where the shared unit label would read wrong for the line (a lime's "skiltelė").
const ingredientRowSchema = z.object({
  position: z.number().int(),
  item: z.string(),
  amount: z.number().nullable(),
  unit: z.string().nullable(),
  recipe_ingredient_translations: z.array(
    z.object({ locale: z.string(), item: z.string(), unit: z.string().nullable() }),
  ),
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
    recipe_translations: z.array(z.object({ locale: z.string(), name: z.string(), instructions: z.string() })),
    recipe_ingredients: z.array(ingredientRowSchema),
  })
  .transform((row) => ({
    id: row.id,
    source: { name: row.name, instructions: row.instructions },
    texts: row.recipe_translations,
    mealType: row.meal_type,
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
        texts: ingredient.recipe_ingredient_translations,
      })),
  }));

export const recipeIdSchema = z.guid();

// A list entry in the viewer's language (X1b), the Lithuanian name when the recipe has no translation in it.
const localizeRecipeSummary = (entry: RecipeListEntry, locale: string): RecipeSummary => ({
  id: entry.id,
  name: pickTranslation(entry.names, locale)?.name ?? entry.sourceName,
  mealType: entry.mealType,
  portionDays: entry.portionDays,
  mainProteins: entry.mainProteins,
});

// The library in the viewer's language, in its alphabetical order.
export const localizeRecipeList = (entries: readonly RecipeListEntry[], locale: string): RecipeSummary[] =>
  entries
    .map((entry) => localizeRecipeSummary(entry, locale))
    .sort((first, second) => first.name.localeCompare(second.name, locale) || first.id.localeCompare(second.id));

// A recipe in the viewer's language (X1b). Each text falls back to Lithuanian on its own; a line keeps its stored unit
// (the unit labels translate it) unless its translation names its own.
export const localizeRecipe = (content: RecipeContent, locale: string): Recipe => {
  const texts = pickTranslation(content.texts, locale) ?? content.source;
  return {
    id: content.id,
    name: texts.name,
    mealType: content.mealType,
    instructions: (texts.instructions || content.source.instructions).trim(),
    portionDays: content.portionDays,
    mainProteins: content.mainProteins,
    sourceItems: content.ingredients.map((ingredient) => ingredient.item),
    ingredients: content.ingredients.map((ingredient) => {
      const translation = pickTranslation(ingredient.texts, locale);
      return {
        position: ingredient.position,
        item: translation?.item ?? ingredient.item,
        amount: ingredient.amount,
        unit: translation?.unit ?? ingredient.unit,
      };
    }),
  };
};
