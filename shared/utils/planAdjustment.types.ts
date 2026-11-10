import type { z } from "zod";
import type { MealType } from "./mealFilter";
import type { planAdjustmentSchema, planConstraintsSchema } from "./planAdjustment.schema";
import type { GeneratorRecipe, PlannedMeal, SlotRecipeExclusion } from "./planGenerator.types";

export type PlanConstraints = z.infer<typeof planConstraintsSchema>;
export type PlanAdjustment = z.infer<typeof planAdjustmentSchema>;

export interface AdjustmentIngredient {
  id: string;
  name: string;
}

// What the AI is told about the plan, and what its answer is checked against. No personal data: dates, meal types and
// the canonical ingredient names.
export interface PlanAdjustmentContext {
  startDate: string;
  dayCount: number;
  // The meal types the plan shows (skipped snacks are left out).
  mealTypes: readonly MealType[];
  ingredients: readonly AdjustmentIngredient[];
}

export type PlanAdjustmentValidation = { ok: true; adjustment: PlanAdjustment } | { ok: false; errors: string[] };

// What getGeneratorConstraints() needs besides the constraints.
export interface GeneratorConstraintContext {
  dayCount: number;
  mealTypes: readonly MealType[];
  recipes: readonly GeneratorRecipe[];
  // Ingredient id → the recipes that use it.
  recipeIdsByIngredient: Readonly<Record<string, readonly string[]>>;
}

export interface GeneratorConstraints {
  slotExclusions: SlotRecipeExclusion[];
  quickMeals: PlannedMeal[];
}
