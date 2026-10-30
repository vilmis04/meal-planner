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
