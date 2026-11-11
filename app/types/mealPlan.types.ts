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

// The plan list (E6): current and upcoming plans by start date, then past plans newest first, a page at a time.
export type MealPlanOverviewResult =
  | { status: "loaded"; activePlans: MealPlanSummary[]; pastPlans: MealPlanSummary[]; hasMorePast: boolean }
  | { status: "failed" };
export type PastMealPlansResult = { status: "loaded"; plans: MealPlanSummary[]; hasMore: boolean } | { status: "failed" };

// Generating a plan (E4): the counts for the message, or the translation key of why nothing was filled.
export type GenerationSummary = Extract<z.output<typeof generatePlanResponseSchema>, { status: "generated" }>;
// What the message after a generation goes by.
export type GenerationCounts = Pick<GenerationSummary, "emptyCount" | "compromisedCount">;
export type GeneratePlanResult = { isGenerated: true; summary: GenerationSummary } | { isGenerated: false; errorKey: string };

// Swapping a slot (E5), or the translation key of why nothing changed.
export type SwapSlotResult = { isSwapped: true } | { isSwapped: false; errorKey: string };
export type SetSlotsLockedResult = { isSaved: true } | { isSaved: false; errorKey: string };
