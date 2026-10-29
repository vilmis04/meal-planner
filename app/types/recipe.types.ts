import type { z } from "zod";
import type { recipeDetailRowSchema, recipeListRowsSchema } from "~/utils/recipe";

export type RecipeSummary = z.output<typeof recipeListRowsSchema>[number];
export type Recipe = z.output<typeof recipeDetailRowSchema>;
export type RecipeIngredient = Recipe["ingredients"][number];

// Kept apart so the page can tell "no such recipe" from "could not ask".
export type RecipeLoadResult =
  | { status: "found"; recipe: Recipe }
  | { status: "not-found" }
  | { status: "failed" };
