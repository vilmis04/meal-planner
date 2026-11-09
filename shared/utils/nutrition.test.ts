import { describe, expect, it } from "vitest";
import {
  getDefaultNutritionParticipant,
  getMacroEnergyShares,
  getMealNutrition,
  getPlanNutrition,
  isNutritionComplete,
} from "./nutrition";
import type { NutritionRecipe, NutritionSlot, PlanNutritionInput, SwapNutritionByRecipe } from "./nutrition.types";

const PORRIDGE = "recipe-porridge";
const CURRY = "recipe-curry";
const CRACKERS = "recipe-crackers";
const SALMON = "recipe-salmon";

const RECIPES = new Map<string, NutritionRecipe>([
  [PORRIDGE, { mainProteins: ["plant"], nutrition: { caloriesKcal: 390, carbohydrates: 62, protein: 14, fat: 9 } }],
  [CURRY, { mainProteins: ["poultry"], nutrition: { caloriesKcal: 690, carbohydrates: 64, protein: 46, fat: 26 } }],
  // Seeded like "Lęšių trapukai": calories and protein, no carbohydrates or fat.
  [CRACKERS, { mainProteins: ["plant"], nutrition: { caloriesKcal: 235, carbohydrates: null, protein: 14.7, fat: null } }],
  [SALMON, { mainProteins: ["fish"], nutrition: { caloriesKcal: 520, carbohydrates: 30, protein: 40, fat: 25 } }],
]);

const SWAPS: SwapNutritionByRecipe = new Map([
  [CURRY, { fish: { caloriesKcal: 720, carbohydrates: 66, protein: 52, fat: 28 } }],
]);

const slot = (id: string, dayIndex: number, recipeId: string | null): NutritionSlot => ({ id, dayIndex, recipeId });

const createInput = (overrides: Partial<PlanNutritionInput>): PlanNutritionInput => ({
  slots: [],
  dayCount: 2,
  recipes: RECIPES,
  diet: "full",
  swapNutrition: SWAPS,
  ...overrides,
});

describe("isNutritionComplete", () => {
  it("needs all four values", () => {
    expect(isNutritionComplete({ caloriesKcal: 0, carbohydrates: 0, protein: 0, fat: 0 })).toBe(true);
    expect(isNutritionComplete({ caloriesKcal: 235, carbohydrates: null, protein: 14.7, fat: null })).toBe(false);
    expect(isNutritionComplete({ caloriesKcal: null, carbohydrates: 38, protein: 30, fat: 29 })).toBe(false);
  });
});

describe("getMealNutrition", () => {
  it("is the recipe's own macros when the diet fits", () => {
    expect(getMealNutrition(CURRY, RECIPES.get(CURRY), "full", SWAPS)).toEqual({
      nutrition: { caloriesKcal: 690, carbohydrates: 64, protein: 46, fat: 26 },
      source: "recipe",
      isApproximate: false,
      isComplete: true,
    });
  });

  it("is the swap's estimate, approximate, when the diet needs a swap", () => {
    expect(getMealNutrition(CURRY, RECIPES.get(CURRY), "fish", SWAPS)).toEqual({
      nutrition: { caloriesKcal: 720, carbohydrates: 66, protein: 52, fat: 28 },
      source: "swap",
      isApproximate: true,
      isComplete: true,
    });
  });

  it("falls back to the recipe's macros, approximate, when no swap estimate is stored", () => {
    const meal = getMealNutrition(CURRY, RECIPES.get(CURRY), "vegetarian", SWAPS);
    expect(meal.source).toBe("recipe_without_swap_estimate");
    expect(meal.isApproximate).toBe(true);
    expect(meal.nutrition.caloriesKcal).toBe(690);
  });

  it("shows every recipe as written when the diet is not known", () => {
    expect(getMealNutrition(CURRY, RECIPES.get(CURRY), null, SWAPS).source).toBe("recipe");
  });

  it("is incomplete for a recipe with missing macros or one the library does not know", () => {
    expect(getMealNutrition(CRACKERS, RECIPES.get(CRACKERS), "full", SWAPS).isComplete).toBe(false);
    expect(getMealNutrition("recipe-deleted", undefined, "full", SWAPS)).toEqual({
      nutrition: { caloriesKcal: null, carbohydrates: null, protein: null, fat: null },
      source: "recipe",
      isApproximate: false,
      isComplete: false,
    });
  });
});

describe("getPlanNutrition", () => {
  it("adds up each day and averages the days", () => {
    const result = getPlanNutrition(
      createInput({
        slots: [slot("a", 0, PORRIDGE), slot("b", 0, CURRY), slot("c", 1, PORRIDGE), slot("d", 1, null)],
      }),
    );

    expect(result.days).toEqual([
      {
        dayIndex: 0,
        total: { caloriesKcal: 1080, carbohydrates: 126, protein: 60, fat: 35 },
        countedMealCount: 2,
        excludedMealCount: 0,
        hasApproximateMeal: false,
      },
      {
        dayIndex: 1,
        total: { caloriesKcal: 390, carbohydrates: 62, protein: 14, fat: 9 },
        countedMealCount: 1,
        excludedMealCount: 0,
        hasApproximateMeal: false,
      },
    ]);
    expect(result.dailyAverage).toEqual({ caloriesKcal: 735, carbohydrates: 94, protein: 37, fat: 22 });
    expect(result.averagedDayCount).toBe(2);
    expect(result.excludedMealCount).toBe(0);
    expect([...result.meals.keys()]).toEqual(["a", "b", "c"]);
  });

  it("leaves recipes with missing macros out of the totals and counts them", () => {
    const result = getPlanNutrition(
      createInput({ slots: [slot("a", 0, PORRIDGE), slot("b", 0, CRACKERS), slot("c", 1, "recipe-deleted")] }),
    );

    expect(result.days[0]?.total).toEqual({ caloriesKcal: 390, carbohydrates: 62, protein: 14, fat: 9 });
    expect(result.days[0]?.excludedMealCount).toBe(1);
    expect(result.days[1]?.total).toBeNull();
    expect(result.days[1]?.excludedMealCount).toBe(1);
    // Day 2 has nothing to count, so the average is day 1's total.
    expect(result.averagedDayCount).toBe(1);
    expect(result.dailyAverage?.caloriesKcal).toBe(390);
    expect(result.excludedMealCount).toBe(2);
    expect(result.meals.get("b")?.nutrition.caloriesKcal).toBe(235);
  });

  it("follows the participant's diet: swaps for a fish eater, the recipe for everyone else", () => {
    const slots = [slot("a", 0, CURRY), slot("b", 0, SALMON)];
    const fish = getPlanNutrition(createInput({ slots, dayCount: 1, diet: "fish" }));
    const full = getPlanNutrition(createInput({ slots, dayCount: 1, diet: "full" }));

    expect(fish.days[0]?.total?.caloriesKcal).toBe(1240);
    expect(fish.days[0]?.hasApproximateMeal).toBe(true);
    expect(full.days[0]?.total?.caloriesKcal).toBe(1210);
    expect(full.days[0]?.hasApproximateMeal).toBe(false);
  });

  it("has no average when nothing is planned", () => {
    const result = getPlanNutrition(createInput({ slots: [slot("a", 0, null)] }));
    expect(result.dailyAverage).toBeNull();
    expect(result.averagedDayCount).toBe(0);
    expect(result.days.every((day) => day.total === null)).toBe(true);
  });

  it("ignores a slot outside the plan's days", () => {
    const result = getPlanNutrition(createInput({ slots: [slot("a", 5, PORRIDGE)], dayCount: 1 }));
    expect(result.meals.size).toBe(0);
    expect(result.dailyAverage).toBeNull();
  });
});

describe("getMacroEnergyShares", () => {
  it("weighs fat at 9 kcal a gram and the others at 4", () => {
    const shares = getMacroEnergyShares({ caloriesKcal: 1920, carbohydrates: 212, protein: 118, fat: 64 });
    expect(shares.carbohydrates).toBeCloseTo(848 / 1896);
    expect(shares.protein).toBeCloseTo(472 / 1896);
    expect(shares.fat).toBeCloseTo(576 / 1896);
  });

  it("is all zero without energy", () => {
    expect(getMacroEnergyShares({ caloriesKcal: 0, carbohydrates: 0, protein: 0, fat: 0 })).toEqual({
      carbohydrates: 0,
      protein: 0,
      fat: 0,
    });
  });
});

describe("getDefaultNutritionParticipant", () => {
  it("opens on the viewer when they eat from the plan, else on its first participant", () => {
    expect(getDefaultNutritionParticipant(["ana", "monika"], "monika")).toBe("monika");
    expect(getDefaultNutritionParticipant(["ana", "monika"], "jonas")).toBe("ana");
    expect(getDefaultNutritionParticipant(["ana"], null)).toBe("ana");
    expect(getDefaultNutritionParticipant([], "ana")).toBeNull();
  });
});
