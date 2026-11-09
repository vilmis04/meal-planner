import { describe, expect, it } from "vitest";
import type { PickableRecipe, PlanSlotRef } from "./slotPicker";
import {
  countSlotRecipes,
  filterSlotRecipes,
  getBatchDays,
  getBatchSlots,
  getBatchTarget,
  getHateWarning,
  getRecentlyPlannedRecipes,
  groupHatedRecipes,
  matchesRecipeFilters,
  normalizeSearch,
} from "./slotPicker";
import type { PlanHistoryEntry, RecipeFilterContext } from "./slotPicker.types";

const recipe = (id: string, name: string, mealType: PickableRecipe["mealType"], portionDays = 1): PickableRecipe => ({
  id,
  name,
  mealType,
  portionDays,
});

const RECIPES = [
  recipe("r1", "Trinta moliūgų sriuba", "dinner", 2),
  recipe("r2", "Vištienos sriuba su frikadelėmis", "dinner", 2),
  recipe("r3", "Kiaušiniai su avokadu", "breakfast"),
  recipe("r4", "Avižinė košė", "breakfast"),
  recipe("r5", "Kugelio pusbrolis", "dinner", 2),
  recipe("r6", "Makaronai su tunu", "lunch", 2),
];

const ids = (recipes: PickableRecipe[]) => recipes.map((item) => item.id);

describe("normalizeSearch", () => {
  it("drops case, Lithuanian accents and extra spaces", () => {
    expect(normalizeSearch("  Kiaušiniai   SU  avokadu ")).toBe("kiausiniai su avokadu");
    expect(normalizeSearch("ĄČĘĖĮŠŲŪŽ")).toBe("aceeisuuz");
  });
});

describe("filterSlotRecipes", () => {
  it("offers only the slot's meal type, by name", () => {
    expect(ids(filterSlotRecipes(RECIPES, "dinner", "", { locale: "lt" }))).toEqual(["r5", "r1", "r2"]);
    expect(ids(filterSlotRecipes(RECIPES, "snack", ""))).toEqual([]);
  });

  it("matches the search without case or accents", () => {
    expect(ids(filterSlotRecipes(RECIPES, "dinner", "SRIUBA"))).toEqual(["r1", "r2"]);
    expect(ids(filterSlotRecipes(RECIPES, "breakfast", "kiausin"))).toEqual(["r3"]);
    expect(ids(filterSlotRecipes(RECIPES, "breakfast", "avizine"))).toEqual(["r4"]);
  });

  it("needs every word of the search, in any order", () => {
    expect(ids(filterSlotRecipes(RECIPES, "dinner", "sriuba vištienos"))).toEqual(["r2"]);
    expect(ids(filterSlotRecipes(RECIPES, "dinner", "sriuba tunu"))).toEqual([]);
  });

  it("does not offer a recipe of another meal type even when the name matches", () => {
    expect(ids(filterSlotRecipes(RECIPES, "dinner", "tunu"))).toEqual([]);
  });

  it("puts the current choice first", () => {
    expect(ids(filterSlotRecipes(RECIPES, "dinner", "", { currentRecipeId: "r2", locale: "lt" }))).toEqual([
      "r2",
      "r5",
      "r1",
    ]);
  });
});

describe("countSlotRecipes", () => {
  it("counts the meal type's recipes", () => {
    expect(countSlotRecipes(RECIPES, "dinner")).toBe(3);
    expect(countSlotRecipes(RECIPES, "snack")).toBe(0);
  });
});

describe("getBatchTarget", () => {
  // Three days of dinners and lunches.
  const slots: PlanSlotRef[] = [0, 1, 2].flatMap((dayIndex) => [
    { id: `l${dayIndex}`, dayIndex, mealType: "lunch" as const, recipeId: null },
    { id: `d${dayIndex}`, dayIndex, mealType: "dinner" as const, recipeId: null },
  ]);
  const withRecipe = (id: string, recipeId: string) =>
    slots.map((slot) => (slot.id === id ? { ...slot, recipeId } : slot));
  const stew = { id: "r1", portionDays: 2 };

  it("offers the next day's same meal for a 2-day recipe", () => {
    const target = getBatchTarget(slots, slots[1]!, stew);
    expect(target.slots.map((slot) => slot.id)).toEqual(["d1"]);
    expect(target).toMatchObject({ fillDays: 2, replaced: [], isOffered: true });
  });

  it("offers nothing for a one-day recipe", () => {
    expect(getBatchTarget(slots, slots[1]!, { id: "r9", portionDays: 1 })).toMatchObject({
      slots: [],
      fillDays: 1,
      isOffered: false,
    });
  });

  it("offers nothing on the plan's last day", () => {
    expect(getBatchTarget(slots, slots[5]!, stew)).toMatchObject({ slots: [], fillDays: 1, isOffered: false });
  });

  it("names a next-day recipe that would be replaced", () => {
    const target = getBatchTarget(withRecipe("d1", "r5"), slots[1]!, stew);
    expect(target.replaced.map((slot) => slot.id)).toEqual(["d1"]);
    expect(target.isOffered).toBe(true);
  });

  it("does not ask when the next day already holds the same recipe", () => {
    const target = getBatchTarget(withRecipe("d1", "r1"), slots[1]!, stew);
    expect(target).toMatchObject({ fillDays: 2, replaced: [], isOffered: false });
  });

  it("stops at the end of the plan for a longer batch", () => {
    const target = getBatchTarget(slots, slots[3]!, { id: "r7", portionDays: 3 });
    expect(target.slots.map((slot) => slot.id)).toEqual(["d2"]);
    expect(target.fillDays).toBe(2);
  });
});

describe("hate warnings", () => {
  const members = [
    { userId: "u-ana", displayName: "Ana" },
    { userId: "u-monika", displayName: "Monika" },
    { userId: "u-petras", displayName: "Petras" },
  ];
  const hated = groupHatedRecipes([
    { recipeId: "r1", userId: "u-monika" },
    { recipeId: "r2", userId: "u-petras" },
    { recipeId: "r2", userId: "u-ana" },
    { recipeId: "r2", userId: "u-monika" },
    { recipeId: "r2", userId: "u-monika" },
    { recipeId: "r3", userId: "u-gone" },
  ]);

  it("groups rows by recipe without repeats", () => {
    expect(hated).toEqual({ r1: ["u-monika"], r2: ["u-petras", "u-ana", "u-monika"], r3: ["u-gone"] });
  });

  it("is null when nobody hates the recipe", () => {
    expect(getHateWarning("r4", hated, members, "u-ana")).toBeNull();
  });

  it("names another participant", () => {
    expect(getHateWarning("r1", hated, members, "u-ana")).toEqual({
      includesViewer: false,
      names: ["Monika"],
      unnamedCount: 0,
    });
  });

  it("puts the viewer apart and the others in member order", () => {
    expect(getHateWarning("r2", hated, members, "u-ana")).toEqual({
      includesViewer: true,
      names: ["Monika", "Petras"],
      unnamedCount: 0,
    });
  });

  it("counts someone with no known name", () => {
    expect(getHateWarning("r3", hated, members, "u-ana")).toEqual({
      includesViewer: false,
      names: [],
      unnamedCount: 1,
    });
  });

  it("shows only the viewer on an individual plan", () => {
    expect(getHateWarning("r1", hated, [], "u-monika")).toEqual({ includesViewer: true, names: [], unnamedCount: 0 });
  });
});

describe("getBatchDays", () => {
  const batchRecipes = [
    { id: "stew", portionDays: 2 },
    { id: "salad", portionDays: 1 },
  ];
  const dinner = (dayIndex: number, recipeId: string | null) => ({
    id: `dinner-${dayIndex}`,
    dayIndex,
    mealType: "dinner" as const,
    recipeId,
  });

  it("marks the days of a batch with their place in it", () => {
    const batchDays = getBatchDays([dinner(0, "stew"), dinner(1, "stew"), dinner(2, "salad")], batchRecipes);
    expect(batchDays.get("dinner-0")).toEqual({
      dayNumber: 1,
      dayCount: 2,
      firstDayIndex: 0,
      lastDayIndex: 1,
      batchNumber: 0,
    });
    expect(batchDays.get("dinner-1")).toEqual({
      dayNumber: 2,
      dayCount: 2,
      firstDayIndex: 0,
      lastDayIndex: 1,
      batchNumber: 0,
    });
    expect(batchDays.has("dinner-2")).toBe(false);
  });

  it("splits a longer run into batches of the recipe's days", () => {
    const batchDays = getBatchDays([0, 1, 2, 3, 4].map((day) => dinner(day, "stew")), batchRecipes);
    expect([0, 1, 2, 3, 4].map((day) => batchDays.get(`dinner-${day}`)?.dayNumber)).toEqual([1, 2, 1, 2, undefined]);
  });

  it("numbers the batches of each meal in day order", () => {
    const lunch = (dayIndex: number) => ({ id: `lunch-${dayIndex}`, dayIndex, mealType: "lunch" as const, recipeId: "stew" });
    const batchDays = getBatchDays(
      [dinner(3, "stew"), dinner(4, "stew"), dinner(0, "stew"), dinner(1, "stew"), dinner(2, "salad"), lunch(2), lunch(3)],
      batchRecipes,
    );
    expect([0, 1, 3, 4].map((day) => batchDays.get(`dinner-${day}`)?.batchNumber)).toEqual([0, 0, 1, 1]);
    expect([2, 3].map((day) => batchDays.get(`lunch-${day}`)?.batchNumber)).toEqual([0, 0]);
  });

  it("ignores one-day recipes, empty slots, gaps and other meals", () => {
    const lunch = { id: "lunch-1", dayIndex: 1, mealType: "lunch" as const, recipeId: "stew" };
    const batchDays = getBatchDays(
      [dinner(0, "salad"), dinner(1, "salad"), dinner(2, null), dinner(3, null), dinner(4, "stew"), dinner(6, "stew"), lunch],
      batchRecipes,
    );
    expect(batchDays.size).toBe(0);
  });
});

describe("getBatchSlots", () => {
  const batchRecipes = [{ id: "stew", portionDays: 2 }];
  const dinner = (dayIndex: number, recipeId: string | null) => ({
    id: `dinner-${dayIndex}`,
    dayIndex,
    mealType: "dinner" as const,
    recipeId,
  });
  const slots = [dinner(2, "stew"), dinner(1, "stew"), dinner(0, "salad"), dinner(3, null)];

  it("gives every day of the slot's batch, in day order, from either day", () => {
    expect(getBatchSlots(slots, batchRecipes, dinner(2, "stew")).map((slot) => slot.id)).toEqual(["dinner-1", "dinner-2"]);
    expect(getBatchSlots(slots, batchRecipes, dinner(1, "stew")).map((slot) => slot.id)).toEqual(["dinner-1", "dinner-2"]);
  });

  it("gives the slot alone when it is not part of a batch", () => {
    const salad = dinner(0, "salad");
    expect(getBatchSlots(slots, batchRecipes, salad)).toEqual([salad]);
  });
});

describe("matchesRecipeFilters", () => {
  const stew = { id: "stew", portionDays: 2, mainProteins: ["plant"] as const };
  const salmon = { id: "salmon", portionDays: 1, mainProteins: ["fish"] as const };
  const curry = { id: "curry", portionDays: 2, mainProteins: ["poultry", "plant"] as const };
  const context: RecipeFilterContext = {
    enjoyedRecipeIds: new Set(["salmon", "curry"]),
    participantDiets: ["fish", "full"],
    recentRecipeIds: new Set(["curry"]),
  };
  const matching = (filters: Parameters<typeof matchesRecipeFilters>[1]) =>
    [stew, salmon, curry].filter((recipe) => matchesRecipeFilters(recipe, filters, context)).map((recipe) => recipe.id);

  it("lets every recipe through with no filter on", () => {
    expect(matching([])).toEqual(["stew", "salmon", "curry"]);
  });

  it("keeps batch recipes, the viewer's enjoyed ones, ones every diet allows, or ones not resting", () => {
    expect(matching(["batch"])).toEqual(["stew", "curry"]);
    expect(matching(["enjoyed"])).toEqual(["salmon", "curry"]);
    expect(matching(["fits_all_diets"])).toEqual(["stew", "salmon"]);
    expect(matching(["not_recent"])).toEqual(["stew", "salmon"]);
  });

  it("needs every filter that is on", () => {
    expect(matching(["batch", "fits_all_diets"])).toEqual(["stew"]);
    expect(matching(["enjoyed", "not_recent"])).toEqual(["salmon"]);
    expect(matching(["batch", "enjoyed", "fits_all_diets", "not_recent"])).toEqual([]);
  });

  it("fits a vegetarian only with egg, dairy and plants", () => {
    const vegetarian = { ...context, participantDiets: ["vegetarian", "full"] as const };
    expect(matchesRecipeFilters(salmon, ["fits_all_diets"], vegetarian)).toBe(false);
    expect(matchesRecipeFilters(stew, ["fits_all_diets"], vegetarian)).toBe(true);
  });
});

describe("getRecentlyPlannedRecipes", () => {
  const target = { planId: "this", startDate: "2026-11-09", cooldownDays: 14, participantIds: ["ana", "monika"] };
  const plan = (id: string, startDate: string, overrides: Partial<PlanHistoryEntry> = {}): PlanHistoryEntry => ({
    id,
    startDate,
    includeSnacks: true,
    participantIds: ["ana"],
    slots: [
      { dayIndex: 0, mealType: "dinner", recipeId: "stew" },
      { dayIndex: 2, mealType: "lunch", recipeId: "soup" },
      { dayIndex: 3, mealType: "snack", recipeId: "nuts" },
      { dayIndex: 4, mealType: "breakfast", recipeId: null },
    ],
    ...overrides,
  });

  it("gives the last day each recipe was planned within the cooldown before the plan starts", () => {
    const recent = getRecentlyPlannedRecipes([plan("last week", "2026-11-02"), plan("before", "2026-10-26")], target);
    expect(Object.fromEntries(recent)).toEqual({ stew: "2026-11-02", soup: "2026-11-04", nuts: "2026-11-05" });
  });

  it("leaves out days before the cooldown, on or after the start, and the plan itself", () => {
    const recent = getRecentlyPlannedRecipes(
      [plan("old", "2026-10-24"), plan("this", "2026-11-02"), plan("overlapping", "2026-11-07")],
      target,
    );
    // The old plan's day 2 is 26 Oct, 14 days before 9 Nov; the overlapping plan's day 0 is 7 Nov.
    expect(Object.fromEntries(recent)).toEqual({ soup: "2026-10-26", nuts: "2026-10-27", stew: "2026-11-07" });
  });

  it("reads only plans sharing a participant, and not their skipped snacks", () => {
    const recent = getRecentlyPlannedRecipes(
      [plan("someone else", "2026-11-02", { participantIds: ["ola"] }), plan("no snacks", "2026-11-02", { includeSnacks: false })],
      target,
    );
    expect([...recent.keys()].sort()).toEqual(["soup", "stew"]);
  });

  it("gives nothing without a cooldown", () => {
    expect(getRecentlyPlannedRecipes([plan("last week", "2026-11-02")], { ...target, cooldownDays: 0 }).size).toBe(0);
  });
});
