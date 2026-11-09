/*
 * Rows the shopping list build reads (G2), as Supabase returns them, parsed into the shapes buildShoppingList() takes.
 */
import { z } from "zod";
import { DIETS, PROTEINS } from "../../shared/utils/diet";
import { INGREDIENT_CATEGORIES } from "../../shared/utils/ingredient";
import { MEAL_TYPES } from "../../shared/utils/mealFilter";
import type { ShoppingListIngredient, ShoppingListRecipe } from "../../shared/utils/shoppingList.types";
import type { StoredShoppingPlan } from "./shoppingListStore.types";

export const SHOPPING_PLAN_COLUMNS =
  "id, include_snacks, snacks_on_list, meal_plan_slots(meal_type, recipe_id), meal_plan_participants(user_id), shopping_lists(source_version, generated_version)";
export const SHOPPING_RECIPE_COLUMNS = "id, portion_days, main_proteins, recipe_ingredients(id, item, amount, unit)";
export const SHOPPING_SWAP_COLUMNS = "recipe_id, diet, recipe_protein_swap_items(recipe_ingredient_id, item, amount, unit)";
export const SHOPPING_ALIAS_COLUMNS = "item, ingredients(id, name, category, on_shopping_list)";

// Supabase hands numeric columns over as numbers, bigint ones too while they fit.
const versionSchema = z.number().int().min(0);

export const shoppingPlanRowSchema = z
  .object({
    id: z.guid(),
    include_snacks: z.boolean(),
    snacks_on_list: z.boolean(),
    meal_plan_slots: z.array(z.object({ meal_type: z.enum(MEAL_TYPES), recipe_id: z.guid().nullable() })),
    meal_plan_participants: z.array(z.object({ user_id: z.guid() })),
    // One list per plan (shopping_lists_plan_id_key), so PostgREST embeds it as an object.
    shopping_lists: z.object({ source_version: versionSchema, generated_version: versionSchema }),
  })
  .transform(
    (row): StoredShoppingPlan => ({
      id: row.id,
      includeSnacks: row.include_snacks,
      snacksOnList: row.snacks_on_list,
      slots: row.meal_plan_slots.map((slot) => ({ mealType: slot.meal_type, recipeId: slot.recipe_id })),
      participantIds: row.meal_plan_participants.map((participant) => participant.user_id),
      sourceVersion: row.shopping_lists.source_version,
      generatedVersion: row.shopping_lists.generated_version,
    }),
  );

export const dietRowsSchema = z.array(z.object({ id: z.guid(), diet: z.enum(DIETS) }));

const amountSchema = z.number().positive().nullable();

export const shoppingRecipeRowsSchema = z.array(
  z
    .object({
      id: z.guid(),
      portion_days: z.number().int().min(1),
      main_proteins: z.array(z.enum(PROTEINS)),
      recipe_ingredients: z.array(
        z.object({ id: z.guid(), item: z.string(), amount: amountSchema, unit: z.string().nullable() }),
      ),
    })
    .transform(
      (row): ShoppingListRecipe => ({
        id: row.id,
        portionDays: row.portion_days,
        mainProteins: row.main_proteins,
        ingredients: row.recipe_ingredients,
      }),
    ),
);

export const shoppingSwapRowsSchema = z.array(
  z.object({
    recipe_id: z.guid(),
    diet: z.enum(DIETS),
    recipe_protein_swap_items: z.array(
      z.object({
        recipe_ingredient_id: z.guid(),
        item: z.string(),
        amount: amountSchema,
        unit: z.string().nullable(),
      }),
    ),
  }),
);

export const aliasRowSchema = z
  .object({
    item: z.string(),
    ingredients: z.object({
      id: z.guid(),
      name: z.string(),
      category: z.enum(INGREDIENT_CATEGORIES),
      on_shopping_list: z.boolean(),
    }),
  })
  .transform((row): [string, ShoppingListIngredient] => [
    row.item,
    {
      id: row.ingredients.id,
      name: row.ingredients.name,
      category: row.ingredients.category,
      isOnShoppingList: row.ingredients.on_shopping_list,
    },
  ]);

// POST /api/plans/:id/shopping-list. Kept here because every file under server/api is a route.
export const shoppingListRouteParamsSchema = z.object({ id: z.guid() });
