import type { z } from "zod";
import type { ProteinSwapView } from "#shared/utils/proteinSwap.types";
import type { recipeDetailRowSchema, recipeListRowsSchema } from "~/utils/recipe";

export type RecipeSummary = z.output<typeof recipeListRowsSchema>[number];
export type Recipe = z.output<typeof recipeDetailRowSchema>;
export type RecipeIngredient = Recipe["ingredients"][number];

// Kept apart so the page can tell "no such recipe" from "could not ask".
export type RecipeLoadResult =
  | { status: "found"; recipe: Recipe }
  | { status: "not-found" }
  | { status: "failed" };

// GET /api/recipes/:id/swaps/:diet (D2); D3 shows it. "pending" comes with a Retry-After header.
export type RecipeProteinSwap = ProteinSwapView;
export type RecipeProteinSwapResponse =
  | { status: "ready"; swap: RecipeProteinSwap }
  | { status: "pending" }
  | { status: "unavailable"; retryAfter: string }
  | { status: "not-needed" };
