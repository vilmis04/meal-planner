import { describe, expect, it } from "vitest";
import { RECIPE_RATINGS, nextRating } from "./recipeRating";
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
