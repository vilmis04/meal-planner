import { describe, expect, it } from "vitest";
import { DEFAULT_MEAL_FILTER, MEAL_FILTERS, MEAL_TYPES, parseMealFilter } from "./mealFilter";

describe("meal types", () => {
  // Written out on purpose: this is the public.meal_type enum.
  it("lists the four meal types of the database enum", () => {
    expect([...MEAL_TYPES]).toEqual(["breakfast", "lunch", "dinner", "snack"]);
  });

  it("offers All first, then every meal type", () => {
    expect([...MEAL_FILTERS]).toEqual(["all", "breakfast", "lunch", "dinner", "snack"]);
  });
});

describe("parseMealFilter", () => {
  it.each(MEAL_FILTERS)("accepts %s", (filter) => {
    expect(parseMealFilter(filter)).toBe(filter);
  });

  it.each([
    ["a missing parameter", undefined],
    ["an empty value", ""],
    ["an unknown meal type", "brunch"],
    ["a different case", "Dinner"],
    ["a repeated parameter", ["dinner", "lunch"]],
    ["a repeated parameter with one value", ["dinner"]],
    ["a null", null],
    ["a number", 3],
  ])("falls back to All for %s", (_description, value) => {
    expect(parseMealFilter(value)).toBe(DEFAULT_MEAL_FILTER);
  });
});
