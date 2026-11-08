/*
 * Generate a plan (E4): read what the pure generator needs, run it, and write the result. The one entry point for
 * POST /api/plans/:id/generate, and later for scheduled plans (H2).
 *
 * E4 fills the empty slots only: a slot that already holds a recipe (chosen by hand) is kept as if locked. E5 adds
 * real per-slot locks and "regenerate", which replaces every unlocked slot; isLocked below is where that plugs in.
 */
import { generateMealPlan } from "../../shared/utils/planGenerator";
import type { SlotAssignment } from "../../shared/utils/planGenerator.types";
import { getVisibleMealTypes } from "../../shared/utils/mealPlan";
import type { GeneratePlanResult, PlanGenerationDeps } from "./planGenerationService.types";

// The history covers the cooldown and the same number of days again, while a rested recipe's weight recovers.
const HISTORY_COOLDOWN_MULTIPLE = 2;

export async function generatePlan(
  { store, createSeed, log = defaultLog }: PlanGenerationDeps,
  { planId, seed = createSeed() }: { planId: string; seed?: number },
): Promise<GeneratePlanResult> {
  const plan = await store.loadPlan(planId);
  if (!plan) {
    return { status: "not-found" };
  }

  const mealTypes = getVisibleMealTypes(plan.includeSnacks);
  const slots = plan.slots.map((slot) => ({ ...slot, isLocked: slot.recipeId !== null }));
  if (!slots.some((slot) => !slot.isLocked && mealTypes.includes(slot.mealType))) {
    return { status: "nothing-to-fill" };
  }

  const [participants, recipes, swapDiets, history] = await Promise.all([
    store.loadParticipants(planId),
    store.loadRecipes(),
    store.loadSwapDiets(),
    store.loadHistory(planId, plan.cooldownDays * HISTORY_COOLDOWN_MULTIPLE),
  ]);
  if (!participants.length) {
    return { status: "no-participants" };
  }

  const assignments = generateMealPlan({
    startDate: plan.startDate,
    dayCount: plan.dayCount,
    mealTypes,
    slots,
    workdays: plan.workdays,
    recipes,
    participants,
    swapDiets,
    history,
    cooldownDays: plan.cooldownDays,
    seed,
  });

  if ((await store.applyGeneration(planId, assignments)) === "plan-changed") {
    return { status: "plan-changed" };
  }

  const summary = summarize(assignments, seed);
  log({ event: "meal_plan_generated", planId, ...summary });
  return { status: "generated", ...summary };
}

const defaultLog = (entry: Record<string, unknown>): void => console.info(JSON.stringify(entry));

const summarize = (assignments: readonly SlotAssignment[], seed: number) => ({
  filledCount: assignments.filter((assignment) => assignment.recipeId !== null).length,
  emptyCount: assignments.filter((assignment) => assignment.recipeId === null).length,
  compromisedCount: assignments.filter((assignment) => assignment.recipeId !== null && assignment.note !== null).length,
  seed,
});
