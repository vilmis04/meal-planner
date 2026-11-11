import { describe, expect, it } from "vitest";
import en from "../../i18n/locales/en.json";
import lt from "../../i18n/locales/lt.json";
import { getStillLikedMeals, preferenceInsightsSchema } from "./preferenceInsights";

const SALMON_ID = "00000000-0000-4000-8000-0000000000e2";
const PORRIDGE_ID = "00000000-0000-4000-8000-0000000000e3";
const STEW_ID = "00000000-0000-4000-8000-0000000000e1";

const row = {
  liked: [
    { id: SALMON_ID, name: "Baked salmon", meal_type: "dinner", planned_count: 3 },
    { id: PORRIDGE_ID, name: "Oat porridge", meal_type: "breakfast", planned_count: 0 },
  ],
  liked_count: 7,
  skipped: [{ id: STEW_ID, name: "Barley stew", meal_type: "dinner", skip_count: 2 }],
  skip_count: 2,
};

describe("preferenceInsightsSchema", () => {
  it("reads get_preference_insights() into the page's shape", () => {
    expect(preferenceInsightsSchema.parse(row)).toEqual({
      liked: [
        { id: SALMON_ID, name: "Baked salmon", mealType: "dinner", plannedCount: 3 },
        { id: PORRIDGE_ID, name: "Oat porridge", mealType: "breakfast", plannedCount: 0 },
      ],
      likedCount: 7,
      skipped: [{ id: STEW_ID, name: "Barley stew", mealType: "dinner", skipCount: 2 }],
      skipCount: 2,
    });
  });

  it("reads empty lists", () => {
    expect(preferenceInsightsSchema.parse({ liked: [], liked_count: 0, skipped: [], skip_count: 0 })).toEqual({
      liked: [],
      likedCount: 0,
      skipped: [],
      skipCount: 0,
    });
  });

  it.each([
    ["a meal type the app does not know", { ...row, skipped: [{ ...row.skipped[0], meal_type: "brunch" }] }],
    ["a skipped meal never skipped", { ...row, skipped: [{ ...row.skipped[0], skip_count: 0 }] }],
    ["a negative count", { ...row, skip_count: -1 }],
    ["a missing total", { liked: row.liked, skipped: row.skipped, skip_count: 2 }],
    ["more meals than the function returns", { ...row, liked: Array.from({ length: 6 }, () => row.liked[0]) }],
    ["a recipe id that is not one", { ...row, liked: [{ ...row.liked[0], id: "salmon" }] }],
  ])("refuses %s", (_case, value) => {
    expect(preferenceInsightsSchema.safeParse(value).success).toBe(false);
  });
});

describe("getStillLikedMeals", () => {
  const liked = preferenceInsightsSchema.parse(row).liked;

  it("keeps the meals still rated enjoy, in order", () => {
    expect(getStillLikedMeals(liked, { [SALMON_ID]: "enjoy", [PORRIDGE_ID]: "enjoy" })).toEqual(liked);
  });

  it("drops a meal rated otherwise or cleared since the page was read", () => {
    expect(getStillLikedMeals(liked, { [SALMON_ID]: "hate" }).map((meal) => meal.id)).toEqual([]);
    expect(getStillLikedMeals(liked, { [PORRIDGE_ID]: "enjoy" }).map((meal) => meal.id)).toEqual([PORRIDGE_ID]);
  });

  it("shows the list as read without the ratings", () => {
    expect(getStillLikedMeals(liked, null)).toEqual(liked);
  });
});

describe("preference insights texts", () => {
  const lookUp = (messages: unknown, key: string): unknown =>
    key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages);

  it.each([
    "insights.meals.title",
    "insights.meals.liked.planned",
    "insights.meals.liked.notPlanned",
    "insights.meals.liked.allEnjoyed",
    "insights.meals.skipped.times",
    "insights.meals.skipped.total",
    "insights.meals.loadFailed",
    "profile.meals.title",
    "profile.meals.hint",
  ])("has %s in both languages", (key) => {
    expect(typeof lookUp(en, key)).toBe("string");
    expect(typeof lookUp(lt, key)).toBe("string");
  });
});
