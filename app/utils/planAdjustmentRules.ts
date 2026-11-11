import { z } from "zod";
import { planAdjustmentSchema } from "#shared/utils/planAdjustment.schema";
import type { PlanConstraints } from "#shared/utils/planAdjustment.types";
import type { PlanConstraintRule } from "~/types/planAdjustment.types";

// GET /api/plan-adjustment/availability (I3).
export const planAdjustmentAvailabilitySchema = z.object({ isAvailable: z.boolean() });

// POST /api/plans/:id/adjustment (I3). A 503 says the AI could not answer.
export const interpretAdjustmentResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("interpreted"), adjustment: planAdjustmentSchema }),
  z.object({ status: z.literal("unavailable") }),
]);

const ADJUSTMENT_FAILED_KEY = "plan.adjust.errors.failed";

const ADJUSTMENT_ERROR_KEY_BY_HTTP_STATUS: Readonly<Record<number, string>> = {
  404: "plan.errors.notFound",
  429: "plan.adjust.errors.limited",
  503: "plan.adjust.errors.unavailable",
};

// Why a request could not be interpreted, by the route's HTTP status (null: no answer at all).
export function getAdjustmentErrorKey(httpStatus: number | null): string {
  return (httpStatus !== null && ADJUSTMENT_ERROR_KEY_BY_HTTP_STATUS[httpStatus]) || ADJUSTMENT_FAILED_KEY;
}

// Every rule of the constraints, in the order the confirmation lists them: exclusions first, then quick meals.
export function getConstraintRules(constraints: PlanConstraints): PlanConstraintRule[] {
  return [
    ...constraints.excludedProteins.map(
      (rule, index): PlanConstraintRule => ({ kind: "excluded_protein", index, ...rule }),
    ),
    ...constraints.excludedIngredients.map(
      ({ ingredientName, dayIndexes, mealTypes }, index): PlanConstraintRule => ({
        kind: "excluded_ingredient",
        index,
        ingredientName,
        dayIndexes,
        mealTypes,
      }),
    ),
    ...constraints.quickMeals.map((rule, index): PlanConstraintRule => ({ kind: "quick_meals", index, ...rule })),
  ];
}

// The constraints without one rule the user took out before applying them.
export function withoutConstraintRule(constraints: PlanConstraints, rule: PlanConstraintRule): PlanConstraints {
  const isKept = (_: unknown, index: number): boolean => index !== rule.index;
  switch (rule.kind) {
    case "excluded_protein":
      return { ...constraints, excludedProteins: constraints.excludedProteins.filter(isKept) };
    case "excluded_ingredient":
      return { ...constraints, excludedIngredients: constraints.excludedIngredients.filter(isKept) };
    case "quick_meals":
      return { ...constraints, quickMeals: constraints.quickMeals.filter(isKept) };
  }
}
