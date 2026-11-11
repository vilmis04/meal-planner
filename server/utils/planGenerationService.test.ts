import { describe, expect, it, vi } from "vitest";
import type { GeneratorRecipe } from "../../shared/utils/planGenerator.types";
import { MEAL_TYPES } from "../../shared/utils/mealFilter";
import { generatePlan, swapPlanSlot } from "./planGenerationService";
import type { PlanGenerationStore, SlotWrite, StoredPlan, StoredSlot } from "./planGenerationStore.types";

const PLAN_ID = "00000000-0000-0000-0000-0000000000a1";

const makePlan = (overrides: Partial<StoredPlan> = {}): StoredPlan => ({
  id: PLAN_ID,
  kind: "household",
  startDate: "2026-11-09",
  dayCount: 2,
  includeSnacks: false,
  workdays: [1, 2, 3, 4, 5],
  cooldownDays: 14,
  slots: [0, 1].flatMap((dayIndex) =>
    MEAL_TYPES.map((mealType) => ({ id: `${dayIndex}-${mealType}`, dayIndex, mealType, recipeId: null, isLocked: false })),
  ),
  ...overrides,
});

// The plan with some slots changed, by slot id ("0-dinner" is day 0's dinner).
const withSlots = (changes: Record<string, Partial<StoredSlot>>, overrides: Partial<StoredPlan> = {}): StoredPlan =>
  makePlan({ slots: makePlan().slots.map((slot) => ({ ...slot, ...changes[slot.id] })), ...overrides });

/*
 * An in-memory store: one plan the user can open and a small library. What would be written is collected; the
 * rules of apply_meal_plan_generation() and apply_meal_plan_swap() themselves are tested in supabase/tests.
 */
const makeStore = (plan: StoredPlan | null, overrides: Partial<PlanGenerationStore> = {}) => {
  const applied: SlotWrite[][] = [];
  const swapped: SlotWrite[][] = [];
  const store: PlanGenerationStore = {
    loadPlan: async (planId) => (planId === plan?.id ? plan : null),
    loadRecipes: async () => [
      { id: "breakfast-1", mealType: "breakfast", portionDays: 1, mainProteins: ["egg_dairy"] },
      { id: "breakfast-2", mealType: "breakfast", portionDays: 1, mainProteins: ["egg_dairy"] },
      { id: "lunch-batch", mealType: "lunch", portionDays: 2, mainProteins: ["plant"] },
      { id: "dinner-fish", mealType: "dinner", portionDays: 1, mainProteins: ["fish"] },
      { id: "snack-1", mealType: "snack", portionDays: 1, mainProteins: ["plant"] },
    ],
    loadSwapDiets: async () => ({}),
    loadParticipants: async () => [{ userId: "ana", diet: "vegetarian", ratings: {} }],
    loadHistory: async () => [],
    applyGeneration: async (_planId, writes) => {
      applied.push([...writes]);
      return "applied";
    },
    applySwap: async (_planId, writes) => {
      swapped.push([...writes]);
      return "applied";
    },
    ...overrides,
  };
  return { store, applied, swapped };
};

// Two vegetarian dinners and a 2-day lunch, so a swap has somewhere to go.
const SWAP_LIBRARY: GeneratorRecipe[] = [
  { id: "breakfast-1", mealType: "breakfast", portionDays: 1, mainProteins: ["egg_dairy"] },
  { id: "lunch-batch", mealType: "lunch", portionDays: 2, mainProteins: ["plant"] },
  { id: "lunch-batch-2", mealType: "lunch", portionDays: 2, mainProteins: ["plant"] },
  { id: "dinner-pasta", mealType: "dinner", portionDays: 1, mainProteins: ["plant"] },
  { id: "dinner-curry", mealType: "dinner", portionDays: 1, mainProteins: ["plant"] },
];

const getWrite = (writes: readonly SlotWrite[] | undefined, dayIndex: number, mealType: string) =>
  writes?.find((write) => write.dayIndex === dayIndex && write.mealType === mealType);

const deps = (store: PlanGenerationStore) => ({ store, createSeed: () => 7, log: vi.fn() });

describe("generatePlan", () => {
  it("fills the empty visible slots and summarises the result", async () => {
    const { store, applied, swapped } = makeStore(makePlan());
    const result = await generatePlan(deps(store), { planId: PLAN_ID });

    expect(result).toEqual({ status: "generated", filledCount: 4, emptyCount: 2, compromisedCount: 0, seed: 7 });
    // A generation is not a swap: nothing it replaces counts as skipped.
    expect(swapped).toHaveLength(0);
    const [assignments] = applied;
    // Snacks are skipped in this plan, so they are not touched.
    expect(assignments?.some((assignment) => assignment.mealType === "snack")).toBe(false);
    expect(assignments?.filter((assignment) => assignment.mealType === "lunch").map((assignment) => assignment.recipeId)).toEqual([
      "lunch-batch",
      "lunch-batch",
    ]);
    // The only dinner is fish, which a vegetarian does not eat.
    expect(assignments?.filter((assignment) => assignment.mealType === "dinner").map((assignment) => assignment.note)).toEqual([
      "no_recipe_fits_diets",
      "no_recipe_fits_diets",
    ]);
  });

  it("keeps slots that already hold a recipe, locked or not, when filling the empty ones", async () => {
    const { store, applied } = makeStore(withSlots({ "0-breakfast": { recipeId: "breakfast-2" } }));
    await generatePlan(deps(store), { planId: PLAN_ID });

    const breakfasts = applied[0]?.filter((write) => write.mealType === "breakfast") ?? [];
    expect(breakfasts).toEqual([
      { dayIndex: 1, mealType: "breakfast", recipeId: "breakfast-1", note: null, previousRecipeId: null },
    ]);
  });

  it("regenerates every unlocked slot and keeps the locked ones", async () => {
    const plan = withSlots({
      "0-breakfast": { recipeId: "breakfast-2", isLocked: true },
      "1-breakfast": { recipeId: "breakfast-2" },
      "0-lunch": { recipeId: "lunch-batch" },
      "1-lunch": { recipeId: "lunch-batch" },
    });
    const { store, applied } = makeStore(plan);
    const result = await generatePlan(deps(store), { planId: PLAN_ID, mode: "regenerate_unlocked" });

    expect(result).toMatchObject({ status: "generated", filledCount: 3, emptyCount: 2 });
    const [writes] = applied;
    expect(getWrite(writes, 0, "breakfast")).toBeUndefined();
    // The locked breakfast-2 counts as planned, so the open day gets the other breakfast.
    expect(getWrite(writes, 1, "breakfast")).toEqual({
      dayIndex: 1,
      mealType: "breakfast",
      recipeId: "breakfast-1",
      note: null,
      previousRecipeId: "breakfast-2",
    });
    // Each write names what the slot held, so a slot changed meanwhile refuses the write.
    expect(getWrite(writes, 0, "lunch")?.previousRecipeId).toBe("lunch-batch");
    expect(getWrite(writes, 0, "dinner")?.previousRecipeId).toBeNull();
  });

  it("treats a locked slot whose recipe was deleted as open", async () => {
    const { store, applied } = makeStore(withSlots({ "0-breakfast": { recipeId: null, isLocked: true } }));
    await generatePlan(deps(store), { planId: PLAN_ID });
    expect(getWrite(applied[0], 0, "breakfast")?.recipeId).not.toBeNull();
  });

  it("says when every slot the plan shows is locked", async () => {
    const plan = makePlan({
      slots: makePlan().slots.map((slot) =>
        slot.mealType === "snack" ? slot : { ...slot, recipeId: "breakfast-1", isLocked: true },
      ),
    });
    const { store, applied } = makeStore(plan);
    expect(await generatePlan(deps(store), { planId: PLAN_ID, mode: "regenerate_unlocked" })).toEqual({
      status: "all-locked",
    });
    expect(applied).toHaveLength(0);
  });

  it("uses the given seed, so a logged generation can be reproduced", async () => {
    const first = makeStore(makePlan());
    const second = makeStore(makePlan());
    const log = vi.fn();
    const result = await generatePlan({ store: first.store, createSeed: () => 1, log }, { planId: PLAN_ID, seed: 99 });
    await generatePlan(deps(second.store), { planId: PLAN_ID, seed: 99 });

    expect(result).toMatchObject({ status: "generated", seed: 99 });
    expect(first.applied).toEqual(second.applied);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ event: "meal_plan_generated", planId: PLAN_ID, mode: "fill_empty", seed: 99 }),
    );
  });

  it("reads the history over twice the cooldown", async () => {
    const loadHistory = vi.fn(async () => []);
    const { store } = makeStore(makePlan({ cooldownDays: 21 }), { loadHistory });
    await generatePlan(deps(store), { planId: PLAN_ID });
    expect(loadHistory).toHaveBeenCalledWith(PLAN_ID, 42);
  });

  it("says when the plan cannot be opened, without reading anything private", async () => {
    const loadParticipants = vi.fn();
    const { store, applied } = makeStore(null, { loadParticipants });
    expect(await generatePlan(deps(store), { planId: PLAN_ID })).toEqual({ status: "not-found" });
    expect(loadParticipants).not.toHaveBeenCalled();
    expect(applied).toHaveLength(0);
  });

  it("says when there is nothing to fill", async () => {
    const plan = makePlan({ slots: makePlan().slots.map((slot) => ({ ...slot, recipeId: slot.mealType === "snack" ? null : "x" })) });
    const { store, applied } = makeStore(plan);
    expect(await generatePlan(deps(store), { planId: PLAN_ID })).toEqual({ status: "nothing-to-fill" });
    expect(applied).toHaveLength(0);
  });

  it("refuses a plan no one eats from", async () => {
    const { store, applied } = makeStore(makePlan(), { loadParticipants: async () => [] });
    expect(await generatePlan(deps(store), { planId: PLAN_ID })).toEqual({ status: "no-participants" });
    expect(applied).toHaveLength(0);
  });

  it("passes on a plan that changed while it was generated", async () => {
    const { store } = makeStore(makePlan(), { applyGeneration: async () => "plan-changed" });
    expect(await generatePlan(deps(store), { planId: PLAN_ID })).toEqual({ status: "plan-changed" });
  });

  it("lets store failures through", async () => {
    const { store } = makeStore(makePlan(), {
      loadRecipes: async () => {
        throw new Error("database down");
      },
    });
    await expect(generatePlan(deps(store), { planId: PLAN_ID })).rejects.toThrow("database down");
  });
});

describe("swapPlanSlot", () => {
  const swapStore = (plan: StoredPlan | null, overrides: Partial<PlanGenerationStore> = {}) =>
    makeStore(plan, { loadRecipes: async () => SWAP_LIBRARY, ...overrides });

  it("replaces the slot with another recipe and leaves every other slot alone", async () => {
    const plan = withSlots({ "0-dinner": { recipeId: "dinner-pasta" }, "1-breakfast": { recipeId: "breakfast-1" } });
    const { store, swapped } = swapStore(plan);
    const result = await swapPlanSlot(deps(store), { planId: PLAN_ID, slotId: "0-dinner" });

    expect(result).toEqual({ status: "swapped", filledCount: 1, emptyCount: 0, compromisedCount: 0, seed: 7 });
    expect(swapped).toEqual([
      [{ dayIndex: 0, mealType: "dinner", recipeId: "dinner-curry", note: null, previousRecipeId: "dinner-pasta" }],
    ]);
  });

  it("writes as a swap, so the replaced recipe is recorded as skipped (I2)", async () => {
    const { store, applied, swapped } = swapStore(withSlots({ "0-dinner": { recipeId: "dinner-pasta" } }));
    await swapPlanSlot(deps(store), { planId: PLAN_ID, slotId: "0-dinner" });

    expect(swapped).toHaveLength(1);
    expect(applied).toHaveLength(0);
  });

  it("swaps both days of a batch together", async () => {
    const plan = withSlots({ "0-lunch": { recipeId: "lunch-batch" }, "1-lunch": { recipeId: "lunch-batch" } });
    const { store, swapped } = swapStore(plan);
    await swapPlanSlot(deps(store), { planId: PLAN_ID, slotId: "1-lunch" });

    expect(swapped[0]?.map((write) => [write.dayIndex, write.recipeId, write.previousRecipeId])).toEqual([
      [0, "lunch-batch-2", "lunch-batch"],
      [1, "lunch-batch-2", "lunch-batch"],
    ]);
  });

  it("suggests a recipe for an empty slot", async () => {
    const { store, swapped } = swapStore(makePlan());
    expect(await swapPlanSlot(deps(store), { planId: PLAN_ID, slotId: "1-breakfast" })).toMatchObject({ status: "swapped" });
    expect(swapped[0]).toEqual([
      { dayIndex: 1, mealType: "breakfast", recipeId: "breakfast-1", note: null, previousRecipeId: null },
    ]);
  });

  it("refuses a locked slot", async () => {
    const { store, swapped } = swapStore(withSlots({ "0-dinner": { recipeId: "dinner-pasta", isLocked: true } }));
    expect(await swapPlanSlot(deps(store), { planId: PLAN_ID, slotId: "0-dinner" })).toEqual({ status: "slot-locked" });
    expect(swapped).toHaveLength(0);
  });

  it("says when no other recipe fits, and writes nothing", async () => {
    const { store, swapped } = swapStore(withSlots({ "0-breakfast": { recipeId: "breakfast-1" } }));
    expect(await swapPlanSlot(deps(store), { planId: PLAN_ID, slotId: "0-breakfast" })).toEqual({
      status: "no-alternative",
    });
    expect(swapped).toHaveLength(0);
  });

  it("says when the slot or the plan cannot be found", async () => {
    const { store } = swapStore(makePlan());
    expect(await swapPlanSlot(deps(store), { planId: PLAN_ID, slotId: "9-dinner" })).toEqual({ status: "not-found" });
    const { store: noPlan } = swapStore(null);
    expect(await swapPlanSlot(deps(noPlan), { planId: PLAN_ID, slotId: "0-dinner" })).toEqual({ status: "not-found" });
  });

  it("refuses a plan no one eats from, and passes on a plan that changed", async () => {
    const empty = swapStore(makePlan(), { loadParticipants: async () => [] });
    expect(await swapPlanSlot(deps(empty.store), { planId: PLAN_ID, slotId: "0-dinner" })).toEqual({
      status: "no-participants",
    });
    const changed = swapStore(makePlan(), { applySwap: async () => "plan-changed" });
    expect(await swapPlanSlot(deps(changed.store), { planId: PLAN_ID, slotId: "0-dinner" })).toEqual({
      status: "plan-changed",
    });
  });
});
