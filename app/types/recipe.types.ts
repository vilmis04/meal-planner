import type { z } from "zod";
import type { ProteinSwapView } from "#shared/utils/proteinSwap.types";
import type { recipeDetailRowSchema, recipeListRowsSchema } from "~/utils/recipe";

// A recipe as read, with its texts in every language (X1b); localizeRecipeSummary() and localizeRecipe() in
// app/utils/recipe.ts pick the viewer's language.
export type RecipeListEntry = z.output<typeof recipeListRowsSchema>[number];
export type RecipeContent = z.output<typeof recipeDetailRowSchema>;

// A recipe in the viewer's language, as the screens show it.
export interface RecipeSummary {
  id: string;
  name: string;
  mealType: RecipeListEntry["mealType"];
  portionDays: number;
  mainProteins: RecipeListEntry["mainProteins"];
}

export interface RecipeIngredient {
  position: number;
  item: string;
  amount: number | null;
  // As stored (g, vnt., skiltelė), which the unit labels translate, or the line's own translated unit.
  unit: string | null;
}

export interface Recipe extends RecipeSummary {
  instructions: string;
  ingredients: RecipeIngredient[];
}

// Kept apart so the page can tell "no such recipe" from "could not ask".
export type RecipeLoadResult =
  | { status: "found"; recipe: RecipeContent }
  | { status: "not-found" }
  | { status: "failed" };

// GET /api/recipes/:id/swaps/:diet (D2); D3 shows it. "missing" (404): not generated yet, and never made at view time.
export type RecipeProteinSwap = ProteinSwapView;
export type RecipeProteinSwapResponse =
  | { status: "ready"; swap: RecipeProteinSwap }
  | { status: "missing" }
  | { status: "not-needed" };

// What recipe detail shows about a swap (D3): nothing, a loading card, the swap (in the viewer's language, X1c), or a
// notice that it isn't ready.
export type RecipeSwapState =
  | { status: "none" }
  | { status: "loading" }
  | { status: "ready"; swap: RecipeProteinSwap }
  | { status: "unavailable" };
