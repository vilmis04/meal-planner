import type { z } from "zod";
import type { PlanKind } from "#shared/utils/mealPlan";
import type { generatePlanResponseSchema, mealPlanDetailRowSchema, mealPlanListRowsSchema } from "~/utils/mealPlan";

export type MealPlanSummary = z.output<typeof mealPlanListRowsSchema>[number];
export type MealPlan = z.output<typeof mealPlanDetailRowSchema>;
export type MealPlanSlot = MealPlan["slots"][number];

export interface NewMealPlan {
  kind: PlanKind;
  startDate: string;
  dayCount: number;
  includeSnacks: boolean;
  snacksOnList: boolean;
  // Household plans only; the database fills in the owner of an individual plan.
  participantIds?: string[];
  // ISO weekdays (1 = Monday) whose lunch and dinner get batch recipes first (E4).
  workdays: number[];
  // Days a planned recipe rests before the generator offers it again (E4).
  cooldownDays: number;
}

export type SnackSettings = Pick<MealPlan, "includeSnacks" | "snacksOnList">;

// Recipe id → ids of the plan's participants who hate it (E3).
export type HatedRecipes = Record<string, string[]>;
export type HatedRecipesResult = { status: "loaded"; hated: HatedRecipes } | { status: "failed" };
export type SetSlotRecipeResult = { isSaved: true } | { isSaved: false; errorKey: string };

export type CreateMealPlanResult = { isCreated: true; id: string } | { isCreated: false; errorKey: string };
export type UpdateParticipantsResult = { isSaved: true } | { isSaved: false; errorKey: string };

// Kept apart so the page can tell "no such plan, or not yours" from "could not ask".
export type MealPlanLoadResult = { status: "found"; plan: MealPlan } | { status: "not-found" } | { status: "failed" };
export type MealPlanListResult = { status: "loaded"; plans: MealPlanSummary[] } | { status: "failed" };

// Generating a plan (E4): the counts for the message, or the translation key of why nothing was filled.
export type GenerationSummary = Extract<z.output<typeof generatePlanResponseSchema>, { status: "generated" }>;
export type GeneratePlanResult = { isGenerated: true; summary: GenerationSummary } | { isGenerated: false; errorKey: string };
