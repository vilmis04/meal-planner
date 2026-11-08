import type { Diet, Protein } from "./diet";
import type { MealType } from "./mealFilter";
import type { RECIPE_FILTERS } from "./slotPicker";

export type RecipeFilter = (typeof RECIPE_FILTERS)[number];

export interface FilterableRecipe {
  id: string;
  portionDays: number;
  mainProteins: readonly Protein[];
}

// What the picker's filters (E6) compare a recipe with.
export interface RecipeFilterContext {
  // The viewer's own "enjoy" ratings. Ratings are private, so nobody else's can be known here.
  enjoyedRecipeIds: ReadonlySet<string>;
  // Every participant's diet; a recipe fits when it fits each of them without a protein swap.
  participantDiets: readonly Diet[];
  // Recipes resting after being planned shortly before this plan (getRecentlyPlannedRecipes()).
  recentRecipeIds: ReadonlySet<string>;
}

// Another plan the viewer can see, with what it planned.
export interface PlanHistoryEntry {
  id: string;
  startDate: string;
  includeSnacks: boolean;
  participantIds: readonly string[];
  slots: readonly { dayIndex: number; mealType: MealType; recipeId: string | null }[];
}

// The plan whose slot is being chosen.
export interface PlanHistoryTarget {
  planId: string;
  startDate: string;
  cooldownDays: number;
  participantIds: readonly string[];
}
