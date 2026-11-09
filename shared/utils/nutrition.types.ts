import type { Diet, Protein } from "./diet";

// Calories and macros of one person's portion, as recipes and protein swaps store them. A value is null when the
// recipe does not say (a few seeded recipes give calories but no carbohydrates or fat, or the other way round).
export interface Nutrition {
  caloriesKcal: number | null;
  carbohydrates: number | null;
  protein: number | null;
  fat: number | null;
}

// Every value known: only such a portion counts towards a total (F1).
export interface CompleteNutrition {
  caloriesKcal: number;
  carbohydrates: number;
  protein: number;
  fat: number;
}

// What the nutrition rules need of a recipe: its main proteins (does the diet need a swap?) and its macros.
export interface NutritionRecipe {
  mainProteins: readonly Protein[];
  nutrition: Nutrition;
}

// Recipe id → the macros of its ready protein swap for each diet that has one with an estimate (D2).
export type SwapNutritionByRecipe = ReadonlyMap<string, Partial<Record<Diet, CompleteNutrition>>>;

/*
 * One meal as a participant eats it:
 *   * recipe: the recipe as written, which fits the participant's diet;
 *   * swap: the protein swap for the participant's diet, whose macros are the AI's estimate;
 *   * recipe_without_swap_estimate: the diet needs a swap but none with an estimate is stored, so the recipe's own
 *     macros stand in for the swapped meal.
 * The last two are approximate.
 */
export type MealNutritionSource = "recipe" | "swap" | "recipe_without_swap_estimate";

export interface MealNutrition {
  nutrition: Nutrition;
  source: MealNutritionSource;
  isApproximate: boolean;
  // False when a value is missing: the meal is shown with what is known and left out of the totals.
  isComplete: boolean;
}

// A slot as the nutrition rules see it: which day it is on and what it holds.
export interface NutritionSlot {
  id: string;
  dayIndex: number;
  recipeId: string | null;
}

export interface DayNutrition {
  dayIndex: number;
  // Null when no meal of the day has complete macros.
  total: CompleteNutrition | null;
  countedMealCount: number;
  excludedMealCount: number;
  hasApproximateMeal: boolean;
}

export interface PlanNutrition {
  // Slot id → the meal's nutrition, for every filled slot given.
  meals: ReadonlyMap<string, MealNutrition>;
  days: DayNutrition[];
  // The average of the day totals over the days that have one; null when no day has.
  dailyAverage: CompleteNutrition | null;
  averagedDayCount: number;
  // Filled slots left out of the totals because their macros are incomplete.
  excludedMealCount: number;
}

export interface PlanNutritionInput {
  slots: readonly NutritionSlot[];
  dayCount: number;
  recipes: ReadonlyMap<string, NutritionRecipe>;
  // The participant whose view is shown; null when it is not known, which shows every recipe as written.
  diet: Diet | null;
  swapNutrition: SwapNutritionByRecipe;
}

// The share of a portion's energy from each macro, 0 to 1, summing to 1 unless there is no energy at all.
export interface MacroShares {
  carbohydrates: number;
  protein: number;
  fat: number;
}
