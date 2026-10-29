/*
 * The meal types recipes come in, and the filter the recipe list offers on top of them.
 *
 * MEAL_TYPES must match the public.meal_type enum (supabase/migrations/20261012000000_create_recipes_and_tips.sql).
 * The list filter lives in the URL as ?meal=<type>; anything that is not one of the four meal types means "all".
 */

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_FILTERS = ["all", ...MEAL_TYPES] as const;
export type MealFilter = (typeof MEAL_FILTERS)[number];

export const DEFAULT_MEAL_FILTER: MealFilter = "all";

// A query value is a string, or an array of strings when the parameter is repeated (?meal=a&meal=b), or missing.
export function parseMealFilter(query: unknown): MealFilter {
  return MEAL_FILTERS.find((filter) => filter === query) ?? DEFAULT_MEAL_FILTER;
}
