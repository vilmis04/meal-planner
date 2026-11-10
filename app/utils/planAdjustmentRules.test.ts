import { describe, expect, it } from "vitest";
import type { PlanConstraints } from "#shared/utils/planAdjustment.types";
import {
  getAdjustmentErrorKey,
  getConstraintRules,
  interpretAdjustmentResponseSchema,
  withoutConstraintRule,
} from "./planAdjustmentRules";

const MUSHROOM_ID = "00000000-0000-4000-8000-000000000001";

const CONSTRAINTS: PlanConstraints = {
  excludedProteins: [
    { protein: "fish", dayIndexes: null, mealTypes: null },
    { protein: "pork", dayIndexes: [1], mealTypes: ["dinner"] },
  ],
  excludedIngredients: [{ ingredientId: MUSHROOM_ID, ingredientName: "Pievagrybiai", dayIndexes: [0], mealTypes: null }],
  quickMeals: [{ dayIndexes: [0], mealTypes: ["dinner"] }],
};

describe("interpretAdjustmentResponseSchema", () => {
  it("reads an interpretation and the unavailable answer", () => {
    expect(
      interpretAdjustmentResponseSchema.safeParse({
        status: "interpreted",
        adjustment: { constraints: CONSTRAINTS, unsupported: ["under 20 minutes"] },
      }).success,
    ).toBe(true);
    expect(interpretAdjustmentResponseSchema.safeParse({ status: "unavailable" }).success).toBe(true);
  });

  it("refuses constraints outside the rules", () => {
    const quickBreakfast = { ...CONSTRAINTS, quickMeals: [{ dayIndexes: null, mealTypes: ["breakfast"] }] };
    expect(
      interpretAdjustmentResponseSchema.safeParse({
        status: "interpreted",
        adjustment: { constraints: quickBreakfast, unsupported: [] },
      }).success,
    ).toBe(false);
  });
});

describe("getAdjustmentErrorKey", () => {
  it("says why by the HTTP status", () => {
    expect(getAdjustmentErrorKey(429)).toBe("plan.adjust.errors.limited");
    expect(getAdjustmentErrorKey(503)).toBe("plan.adjust.errors.unavailable");
    expect(getAdjustmentErrorKey(404)).toBe("plan.errors.notFound");
    expect(getAdjustmentErrorKey(500)).toBe("plan.adjust.errors.failed");
    expect(getAdjustmentErrorKey(null)).toBe("plan.adjust.errors.failed");
  });
});

describe("constraint rules", () => {
  it("lists every rule with its place in its own list", () => {
    expect(getConstraintRules(CONSTRAINTS)).toEqual([
      { kind: "excluded_protein", index: 0, protein: "fish", dayIndexes: null, mealTypes: null },
      { kind: "excluded_protein", index: 1, protein: "pork", dayIndexes: [1], mealTypes: ["dinner"] },
      { kind: "excluded_ingredient", index: 0, ingredientName: "Pievagrybiai", dayIndexes: [0], mealTypes: null },
      { kind: "quick_meals", index: 0, dayIndexes: [0], mealTypes: ["dinner"] },
    ]);
  });

  it("takes one rule out and keeps the rest", () => {
    const [, pork, mushrooms, quick] = getConstraintRules(CONSTRAINTS);
    expect(withoutConstraintRule(CONSTRAINTS, pork!).excludedProteins).toEqual([CONSTRAINTS.excludedProteins[0]]);
    expect(withoutConstraintRule(CONSTRAINTS, mushrooms!)).toEqual({ ...CONSTRAINTS, excludedIngredients: [] });
    expect(withoutConstraintRule(CONSTRAINTS, quick!)).toEqual({ ...CONSTRAINTS, quickMeals: [] });
  });
});
