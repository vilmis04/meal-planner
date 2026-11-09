import { describe, expect, it, vi } from "vitest";
import type { Diet } from "../../shared/utils/diet";
import type { ShoppingListBuild, ShoppingListRecipe } from "../../shared/utils/shoppingList.types";
import { refreshShoppingList } from "./shoppingListService";
import type { ShoppingListStore, StoredShoppingPlan } from "./shoppingListStore.types";

const PLAN_ID = "00000000-0000-0000-0000-0000000000a1";
const ANA = "00000000-0000-0000-0000-000000000001";
const MONIKA = "00000000-0000-0000-0000-000000000002";

const CHILLI: ShoppingListRecipe = {
  id: "recipe-chilli",
  portionDays: 1,
  mainProteins: ["beef"],
  ingredients: [{ id: "chilli-1", item: "Jautiena", amount: 150, unit: "g" }],
};

const makePlan = (overrides: Partial<StoredShoppingPlan> = {}): StoredShoppingPlan => ({
  id: PLAN_ID,
  includeSnacks: true,
  snacksOnList: true,
  slots: [{ mealType: "dinner", recipeId: CHILLI.id }],
  participantIds: [ANA, MONIKA],
  sourceVersion: 2,
  generatedVersion: 1,
  ...overrides,
});

/*
 * An in-memory store with one plan; what would be written is collected. The rules of apply_shopping_list_generation()
 * themselves are tested in supabase/tests/shopping_lists.test.sql.
 */
const makeStore = (plans: StoredShoppingPlan[], overrides: Partial<ShoppingListStore> = {}) => {
  const applied: { basedOnVersion: number; build: ShoppingListBuild }[] = [];
  const loadPlan = vi.fn(async (planId: string) => {
    const plan = plans[Math.min(loadPlan.mock.calls.length - 1, plans.length - 1)];
    return plan?.id === planId ? plan : null;
  });
  const loadSwaps = vi.fn(async () => new Map());
  const store: ShoppingListStore = {
    loadPlan,
    loadDiets: async () =>
      new Map<string, Diet>([
        [ANA, "full"],
        [MONIKA, "full"],
      ]),
    loadRecipes: async () => new Map([[CHILLI.id, CHILLI]]),
    loadSwaps,
    loadAliases: async () => new Map(),
    applyList: async (_planId, basedOnVersion, build) => {
      applied.push({ basedOnVersion, build });
      return "applied";
    },
    ...overrides,
  };
  return { store, applied, loadPlan, loadSwaps };
};

describe("refreshShoppingList", () => {
  it("builds an out-of-date list and writes it against the version it read", async () => {
    const { store, applied, loadSwaps } = makeStore([makePlan()]);

    const result = await refreshShoppingList({ store }, { planId: PLAN_ID });

    expect(result).toEqual({ status: "refreshed", itemCount: 1, missingSwapCount: 0 });
    expect(applied).toHaveLength(1);
    expect(applied[0]?.basedOnVersion).toBe(2);
    expect(applied[0]?.build.items).toMatchObject([{ key: "item:Jautiena|g", amount: 300, unit: "g" }]);
    // Every participant eats beef, so no swap is read.
    expect(loadSwaps).not.toHaveBeenCalled();
  });

  it("writes nothing when the list is up to date", async () => {
    const { store, applied } = makeStore([makePlan({ generatedVersion: 2 })]);

    expect(await refreshShoppingList({ store }, { planId: PLAN_ID })).toEqual({ status: "up-to-date" });
    expect(applied).toEqual([]);
  });

  it("answers not-found for a plan the user cannot open", async () => {
    const { store } = makeStore([makePlan()]);

    expect(await refreshShoppingList({ store }, { planId: "00000000-0000-0000-0000-0000000000b2" })).toEqual({
      status: "not-found",
    });
  });

  it("reads the swaps of the diets that need one", async () => {
    const { store, loadSwaps } = makeStore([makePlan()], {
      loadDiets: async () =>
        new Map<string, Diet>([
          [ANA, "full"],
          [MONIKA, "vegetarian"],
        ]),
    });

    const result = await refreshShoppingList({ store }, { planId: PLAN_ID });

    expect(loadSwaps).toHaveBeenCalledWith([CHILLI.id], ["vegetarian"]);
    expect(result).toEqual({ status: "refreshed", itemCount: 1, missingSwapCount: 1 });
  });

  it("writes an empty list for a plan without recipes or participants, reading nothing else", async () => {
    const loadRecipes = vi.fn();
    const { store, applied } = makeStore([makePlan({ participantIds: [] })], { loadRecipes });

    expect(await refreshShoppingList({ store }, { planId: PLAN_ID })).toEqual({
      status: "refreshed",
      itemCount: 0,
      missingSwapCount: 0,
    });
    expect(applied[0]?.build).toEqual({ items: [], missingSwapCount: 0 });
    expect(loadRecipes).not.toHaveBeenCalled();
  });

  it("builds again from the changed plan when the write is refused, and gives up after three tries", async () => {
    const changedPlan = makePlan({ sourceVersion: 3, slots: [] });
    const refusedOnce = vi.fn().mockResolvedValueOnce("list-changed").mockResolvedValue("applied");
    const { store, loadPlan } = makeStore([makePlan(), changedPlan], { applyList: refusedOnce });

    expect(await refreshShoppingList({ store }, { planId: PLAN_ID })).toEqual({
      status: "refreshed",
      itemCount: 0,
      missingSwapCount: 0,
    });
    expect(loadPlan).toHaveBeenCalledTimes(2);
    expect(refusedOnce).toHaveBeenLastCalledWith(PLAN_ID, 3, { items: [], missingSwapCount: 0 });

    const alwaysRefused = vi.fn().mockResolvedValue("list-changed");
    const busy = makeStore([makePlan()], { applyList: alwaysRefused });
    expect(await refreshShoppingList({ store: busy.store }, { planId: PLAN_ID })).toEqual({ status: "list-changed" });
    expect(alwaysRefused).toHaveBeenCalledTimes(3);
  });

  it("fails rather than guess a participant's diet", async () => {
    const { store, applied } = makeStore([makePlan()], { loadDiets: async () => new Map([[ANA, "full"]]) });

    await expect(refreshShoppingList({ store }, { planId: PLAN_ID })).rejects.toThrow(/diet of participant/);
    expect(applied).toEqual([]);
  });
});
