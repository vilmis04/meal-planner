import { describe, expect, it } from "vitest";
import type { PickableRecipe, PlanSlotRef } from "./slotPicker";
import {
  countSlotRecipes,
  filterSlotRecipes,
  getBatchTarget,
  getHateWarning,
  groupHatedRecipes,
  normalizeSearch,
} from "./slotPicker";

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
