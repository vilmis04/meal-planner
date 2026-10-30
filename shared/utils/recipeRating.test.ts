import { describe, expect, it } from "vitest";
import { DEFAULT_RATING_TAB, RECIPE_RATINGS, groupRecipesByRating, nextRating, parseRatingTab } from "./recipeRating";
import type { RecipeRating } from "./recipeRating";

describe("recipe ratings", () => {
  it("lists the three ratings the database accepts", () => {
    expect([...RECIPE_RATINGS]).toEqual(["enjoy", "enjoy_less", "hate"]);
  });
});

describe("nextRating", () => {
  it.each(RECIPE_RATINGS)("rates an unrated recipe %s", (tapped) => {
    expect(nextRating(null, tapped)).toBe(tapped);
  });

  it.each(RECIPE_RATINGS)("clears a recipe when %s is tapped again", (rating) => {
    expect(nextRating(rating, rating)).toBeNull();
  });

  const changes: [RecipeRating, RecipeRating][] = RECIPE_RATINGS.flatMap((current) =>
    RECIPE_RATINGS.filter((tapped) => tapped !== current).map((tapped): [RecipeRating, RecipeRating] => [current, tapped]),
  );

  it.each(changes)("changes %s to %s", (current, tapped) => {
    expect(nextRating(current, tapped)).toBe(tapped);
  });
});

describe("parseRatingTab", () => {
  it.each(RECIPE_RATINGS)("keeps %s", (rating) => {
    expect(parseRatingTab(rating)).toBe(rating);
  });

  it("opens the first tab when the value is missing, unknown or repeated", () => {
    expect(DEFAULT_RATING_TAB).toBe("enjoy");
    expect(parseRatingTab(undefined)).toBe("enjoy");
    expect(parseRatingTab("")).toBe("enjoy");
    expect(parseRatingTab("love")).toBe("enjoy");
    expect(parseRatingTab(["hate", "enjoy_less"])).toBe("enjoy");
  });
});

describe("groupRecipesByRating", () => {
  const recipes = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

  it("returns three empty groups when nothing is rated", () => {
    expect(groupRecipesByRating(recipes, {})).toEqual({ enjoy: [], enjoy_less: [], hate: [] });
  });

  it("groups recipes by rating and keeps the order of the recipes", () => {
    const groups = groupRecipesByRating(recipes, { d: "enjoy", b: "hate", a: "enjoy", c: "enjoy_less" });

    expect(groups.enjoy.map((recipe) => recipe.id)).toEqual(["a", "d"]);
    expect(groups.enjoy_less.map((recipe) => recipe.id)).toEqual(["c"]);
    expect(groups.hate.map((recipe) => recipe.id)).toEqual(["b"]);
  });

  it("leaves out unrated recipes and ratings for recipes that are not in the list", () => {
    const groups = groupRecipesByRating(recipes, { a: "enjoy", gone: "hate" });

    expect(groups).toEqual({ enjoy: [{ id: "a" }], enjoy_less: [], hate: [] });
  });
});
