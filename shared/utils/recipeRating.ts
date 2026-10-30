/*
 * The ratings a user can give a recipe (C3), and what a tap on a rating does.
 *
 * RECIPE_RATINGS must match the user_recipe_preferences_rating_supported constraint
 * (supabase/migrations/20261030000000_create_user_recipe_preferences.sql). A recipe with no rating has no row,
 * so "unrated" is null here and not a fourth value.
 */

export const RECIPE_RATINGS = ["enjoy", "enjoy_less", "hate"] as const;
export type RecipeRating = (typeof RECIPE_RATINGS)[number];

// Tapping the rating a recipe already has clears it; tapping another one replaces it.
export function nextRating(current: RecipeRating | null, tapped: RecipeRating): RecipeRating | null {
  return current === tapped ? null : tapped;
}

/*
 * The "my meal ratings" list (C4) shows one tab per rating. The tab lives in the URL as ?rating=<rating>;
 * anything that is not one of the three ratings means the first tab.
 */

export const DEFAULT_RATING_TAB: RecipeRating = "enjoy";

// A query value is a string, or an array of strings when the parameter is repeated, or missing.
export function parseRatingTab(query: unknown): RecipeRating {
  return RECIPE_RATINGS.find((rating) => rating === query) ?? DEFAULT_RATING_TAB;
}

// The recipes of each rating, in the order the recipes came in. Unrated recipes are left out, and so are ratings
// for recipes that are not in the list (a recipe removed from the library).
export function groupRecipesByRating<T extends { id: string }>(
  recipes: readonly T[],
  ratings: Readonly<Record<string, RecipeRating>>,
): Record<RecipeRating, T[]> {
  const groups: Record<RecipeRating, T[]> = { enjoy: [], enjoy_less: [], hate: [] };
  for (const recipe of recipes) {
    const rating = ratings[recipe.id];
    if (rating) {
      groups[rating].push(recipe);
    }
  }
  return groups;
}
