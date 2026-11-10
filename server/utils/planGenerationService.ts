/*
 * Generate a plan (E4) and adjust it (E5): read what the pure generator needs, run it, and write the result. The one
 * entry point for POST /api/plans/:id/generate, POST /api/plans/:id/slots/:slotId/swap and scheduled plans (H2,
 * scheduledPlanService.ts).
 *
 * A locked slot is always kept (a recipe chosen by hand is locked). "fill_empty" also keeps every slot that holds a
 * recipe; "regenerate_unlocked" replaces the generated ones. A swap runs the generator on one slot, or on the days
 * of its batch, with everything else kept, and without the recipe it replaces.
 */
import { generateMealPlan } from "../../shared/utils/planGenerator";
import type { GeneratorSlot, PlanGenerationInput, SlotAssignment } from "../../shared/utils/planGenerator.types";
import { getVisibleMealTypes } from "../../shared/utils/mealPlan";
import type { GenerationMode } from "../../shared/utils/mealPlan";
import { getBatchSlots } from "../../shared/utils/slotPicker";
import { writeJsonLog } from "./jsonLog";
import type { GeneratePlanResult, PlanGenerationDeps, SwapSlotResult } from "./planGenerationService.types";
import type { PlanGenerationStore, SlotWrite, StoredPlan, StoredSlot } from "./planGenerationStore.types";

// The history covers the cooldown and the same number of days again, while a rested recipe's weight recovers.
const HISTORY_COOLDOWN_MULTIPLE = 2;

export async function generatePlan(
  { store, createSeed, log = writeJsonLog }: PlanGenerationDeps,
  { planId, seed = createSeed(), mode = "fill_empty" }: { planId: string; seed?: number; mode?: GenerationMode },
): Promise<GeneratePlanResult> {
  const plan = await store.loadPlan(planId);
  if (!plan) {
    return { status: "not-found" };
  }

  const mealTypes = getVisibleMealTypes(plan.includeSnacks);
  const isKept = (slot: StoredSlot): boolean => isSlotLocked(slot) || (mode === "fill_empty" && slot.recipeId !== null);
  const slots = plan.slots.map((slot): GeneratorSlot => ({ ...slot, isLocked: isKept(slot) }));
  if (!slots.some((slot) => !slot.isLocked && mealTypes.includes(slot.mealType))) {
    return { status: mode === "fill_empty" ? "nothing-to-fill" : "all-locked" };
  }

  const inputs = await loadGeneratorInputs(store, plan);
  if (!inputs.participants.length) {
    return { status: "no-participants" };
  }

  const assignments = generateMealPlan({ ...inputs, slots, seed });
  if ((await store.applyGeneration(plan.id, withPreviousRecipes(plan, assignments))) === "plan-changed") {
    return { status: "plan-changed" };
  }

  const summary = summarize(assignments, seed);
  log({ event: "meal_plan_generated", planId, mode, ...summary });
  return { status: "generated", ...summary };
}

export async function swapPlanSlot(
  { store, createSeed, log = writeJsonLog }: PlanGenerationDeps,
  { planId, slotId, seed = createSeed() }: { planId: string; slotId: string; seed?: number },
): Promise<SwapSlotResult> {
  const plan = await store.loadPlan(planId);
  const target = plan?.slots.find((slot) => slot.id === slotId);
  if (!plan || !target) {
    return { status: "not-found" };
  }
  if (isSlotLocked(target)) {
    return { status: "slot-locked" };
  }

  const inputs = await loadGeneratorInputs(store, plan);
  if (!inputs.participants.length) {
    return { status: "no-participants" };
  }

  // A batch is cooked once, so its days are swapped together; a day someone locked stays.
  const swapped = getBatchSlots(plan.slots, inputs.recipes, target).filter((slot) => !isSlotLocked(slot));
  const swappedIds = new Set(swapped.map((slot) => slot.id));
  const assignments = generateMealPlan({
    ...inputs,
    slots: plan.slots.map((slot): GeneratorSlot => ({ ...slot, isLocked: !swappedIds.has(slot.id) })),
    excludedRecipeIds: swapped.flatMap((slot) => slot.recipeId ?? []),
    seed,
  });
  if (!assignments.some((assignment) => assignment.recipeId !== null)) {
    return { status: "no-alternative" };
  }

  if ((await store.applySwap(plan.id, withPreviousRecipes(plan, assignments))) === "plan-changed") {
    return { status: "plan-changed" };
  }

  const summary = summarize(assignments, seed);
  log({ event: "meal_plan_slot_swapped", planId, slotId, ...summary });
  return { status: "swapped", ...summary };
}

// A slot whose recipe was deleted from the library is open again, whatever its lock says.
const isSlotLocked = (slot: StoredSlot): boolean => slot.isLocked && slot.recipeId !== null;

// Everything the generator needs except the slots and the seed.
const loadGeneratorInputs = async (
  store: PlanGenerationStore,
  plan: StoredPlan,
): Promise<Omit<PlanGenerationInput, "slots" | "seed">> => {
  const [participants, recipes, swapDiets, history] = await Promise.all([
    store.loadParticipants(plan.id),
    store.loadRecipes(),
    store.loadSwapDiets(),
    store.loadHistory(plan.id, plan.cooldownDays * HISTORY_COOLDOWN_MULTIPLE),
  ]);
  return {
    startDate: plan.startDate,
    dayCount: plan.dayCount,
    mealTypes: getVisibleMealTypes(plan.includeSnacks),
    workdays: plan.workdays,
    recipes,
    participants,
    swapDiets,
    history,
    cooldownDays: plan.cooldownDays,
  };
};

// Each assignment goes with the recipe its slot held when the plan was read, so a slot changed meanwhile refuses
// the whole write (and a swap knows which recipes it replaced).
const withPreviousRecipes = (plan: StoredPlan, assignments: readonly SlotAssignment[]): SlotWrite[] => {
  const getSlotKey = ({ dayIndex, mealType }: { dayIndex: number; mealType: string }): string => `${dayIndex}:${mealType}`;
  const previousRecipeIds = new Map(plan.slots.map((slot) => [getSlotKey(slot), slot.recipeId]));
  return assignments.map((assignment) => ({
    ...assignment,
    previousRecipeId: previousRecipeIds.get(getSlotKey(assignment)) ?? null,
  }));
};

const summarize = (assignments: readonly SlotAssignment[], seed: number) => ({
  filledCount: assignments.filter((assignment) => assignment.recipeId !== null).length,
  emptyCount: assignments.filter((assignment) => assignment.recipeId === null).length,
  compromisedCount: assignments.filter((assignment) => assignment.recipeId !== null && assignment.note !== null).length,
  seed,
});
