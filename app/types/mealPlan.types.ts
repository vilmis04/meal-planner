import type { z } from "zod";
import type { PlanKind } from "#shared/utils/mealPlan";
import type { mealPlanDetailRowSchema, mealPlanListRowsSchema } from "~/utils/mealPlan";

export type MealPlanSummary = z.output<typeof mealPlanListRowsSchema>[number];
export type MealPlan = z.output<typeof mealPlanDetailRowSchema>;
export type MealPlanSlot = MealPlan["slots"][number];

export interface NewMealPlan {
  kind: PlanKind;
  startDate: string;
  dayCount: number;
  includeSnacks: boolean;
  snacksOnList: boolean;
}

export type SnackSettings = Pick<MealPlan, "includeSnacks" | "snacksOnList">;

export type CreateMealPlanResult = { isCreated: true; id: string } | { isCreated: false; errorKey: string };

// Kept apart so the page can tell "no such plan, or not yours" from "could not ask".
export type MealPlanLoadResult = { status: "found"; plan: MealPlan } | { status: "not-found" } | { status: "failed" };
export type MealPlanListResult = { status: "loaded"; plans: MealPlanSummary[] } | { status: "failed" };
