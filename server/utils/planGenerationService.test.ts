import { describe, expect, it, vi } from "vitest";
import type { SlotAssignment } from "../../shared/utils/planGenerator.types";
import { MEAL_TYPES } from "../../shared/utils/mealFilter";
import { generatePlan } from "./planGenerationService";
import type { PlanGenerationStore, StoredPlan } from "./planGenerationStore.types";

const PLAN_ID = "00000000-0000-0000-0000-0000000000a1";

const makePlan = (overrides: Partial<StoredPlan> = {}): StoredPlan => ({
  id: PLAN_ID,
  kind: "household",
  startDate: "2026-11-09",
  dayCount: 2,
  includeSnacks: false,
  workdays: [1, 2, 3, 4, 5],
  cooldownDays: 14,
  slots: [0, 1].flatMap((dayIndex) => MEAL_TYPES.map((mealType) => ({ dayIndex, mealType, recipeId: null }))),
  ...overrides,
});

/*
 * An in-memory store: one plan the user can open, a small library, and apply rules like
 * apply_meal_plan_generation() (only empty slots). The SQL itself is tested in supabase/tests.
 */
const makeStore = (plan: StoredPlan | null, overrides: Partial<PlanGenerationStore> = {}) => {
  const applied: SlotAssignment[][] = [];
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
    applyGeneration: async (_planId, assignments) => {
      applied.push([...assignments]);
      return "applied";
    },
    ...overrides,
  };
  return { store, applied };
};

const deps = (store: PlanGenerationStore) => ({ store, createSeed: () => 7, log: vi.fn() });

describe("generatePlan", () => {
  it("fills the empty visible slots and summarises the result", async () => {
    const { store, applied } = makeStore(makePlan());
    const result = await generatePlan(deps(store), { planId: PLAN_ID });

    expect(result).toEqual({ status: "generated", filledCount: 4, emptyCount: 2, compromisedCount: 0, seed: 7 });
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

  it("keeps slots that already hold a recipe", async () => {
    const plan = makePlan({
      slots: makePlan().slots.map((slot) =>
        slot.dayIndex === 0 && slot.mealType === "breakfast" ? { ...slot, recipeId: "breakfast-2" } : slot,
      ),
    });
    const { store, applied } = makeStore(plan);
    await generatePlan(deps(store), { planId: PLAN_ID });

    const breakfasts = applied[0]?.filter((assignment) => assignment.mealType === "breakfast") ?? [];
    expect(breakfasts).toEqual([{ dayIndex: 1, mealType: "breakfast", recipeId: "breakfast-1", note: null }]);
  });

  it("uses the given seed, so a logged generation can be reproduced", async () => {
    const first = makeStore(makePlan());
    const second = makeStore(makePlan());
    const log = vi.fn();
    const result = await generatePlan({ store: first.store, createSeed: () => 1, log }, { planId: PLAN_ID, seed: 99 });
    await generatePlan(deps(second.store), { planId: PLAN_ID, seed: 99 });

    expect(result).toMatchObject({ status: "generated", seed: 99 });
    expect(first.applied).toEqual(second.applied);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: "meal_plan_generated", planId: PLAN_ID, seed: 99 }));
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
