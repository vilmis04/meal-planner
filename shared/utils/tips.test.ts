import { describe, expect, it } from "vitest";
import { getIngredientTips, getPlanTips, getRecipeTips, getTipStartIndex, HOUSEHOLD_TIP_TAG, PLAN_TIP_TAG } from "./tips";
import type { TipIngredient } from "./tips.types";

const AVOCADO_STORAGE = { id: "avocado-storage", tags: ["avocado", "storage", "tips"] };
const ALTERNATIVES = { id: "alternatives", tags: ["substitutions", "alternatives"] };
const FREEZING = { id: "freezing", tags: ["freezing", "bread", "storage"] };
const PLANNING = { id: "planning", tags: ["planning", PLAN_TIP_TAG] };
const FAMILY = { id: "family", tags: [HOUSEHOLD_TIP_TAG, "portions", PLAN_TIP_TAG] };
const UNTAGGED = { id: "untagged", tags: [] };
const TIPS = [AVOCADO_STORAGE, ALTERNATIVES, FREEZING, PLANNING, FAMILY, UNTAGGED];

const AVOCADO: TipIngredient = { id: "avocado", tipTags: ["avocado", "alternatives"], aliases: ["Avokadas", "Avokadas (pusė)"] };
const CHICKEN: TipIngredient = { id: "chicken", tipTags: ["freezing", "alternatives"], aliases: ["Vištienos filė"] };
const BREAD: TipIngredient = { id: "bread", tipTags: ["bread"], aliases: ["Duona"] };
const EGGS: TipIngredient = { id: "eggs", tipTags: [], aliases: ["Kiaušiniai"] };
const INGREDIENTS = [AVOCADO, CHICKEN, BREAD, EGGS];

describe("getIngredientTips", () => {
  it("returns the tips sharing a tag with the ingredient, in their order", () => {
    expect(getIngredientTips(TIPS, AVOCADO.tipTags)).toEqual([AVOCADO_STORAGE, ALTERNATIVES]);
    expect(getIngredientTips(TIPS, ["bread"])).toEqual([FREEZING]);
  });

  it("returns none for an ingredient without tags or with tags no tip has", () => {
    expect(getIngredientTips(TIPS, [])).toEqual([]);
    expect(getIngredientTips(TIPS, ["quinoa"])).toEqual([]);
  });

  it("never matches a tip by a tag of its own only", () => {
    expect(getIngredientTips(TIPS, ["plan"])).toEqual([PLANNING, FAMILY]);
    expect(getIngredientTips([UNTAGGED], ["avocado"])).toEqual([]);
  });
});

describe("getRecipeTips", () => {
  it("matches the recipe's items to ingredients through their aliases", () => {
    expect(getRecipeTips(TIPS, INGREDIENTS, ["Avokadas (pusė)", "Kiaušiniai"])).toEqual([
      { tip: AVOCADO_STORAGE, ingredientIds: ["avocado"] },
      { tip: ALTERNATIVES, ingredientIds: ["avocado"] },
    ]);
  });

  it("puts a tip about more of the recipe's ingredients first, keeping the order otherwise", () => {
    expect(getRecipeTips(TIPS, INGREDIENTS, ["Duona", "Vištienos filė", "Avokadas"])).toEqual([
      { tip: ALTERNATIVES, ingredientIds: ["chicken", "avocado"] },
      { tip: FREEZING, ingredientIds: ["bread", "chicken"] },
      { tip: AVOCADO_STORAGE, ingredientIds: ["avocado"] },
    ]);
  });

  it("counts lines naming the same ingredient once", () => {
    expect(getRecipeTips(TIPS, INGREDIENTS, ["Avokadas", "Avokadas (pusė)"])).toEqual([
      { tip: AVOCADO_STORAGE, ingredientIds: ["avocado"] },
      { tip: ALTERNATIVES, ingredientIds: ["avocado"] },
    ]);
  });

  it("skips items no ingredient knows and ingredients without tags", () => {
    expect(getRecipeTips(TIPS, INGREDIENTS, ["Kiaušiniai", "Bolivinė balanda"])).toEqual([]);
    expect(getRecipeTips(TIPS, INGREDIENTS, [])).toEqual([]);
    expect(getRecipeTips(TIPS, [], ["Avokadas"])).toEqual([]);
  });
});

describe("getPlanTips", () => {
  it("shows the plan tips, the family ones only on a plan for several people", () => {
    expect(getPlanTips(TIPS, 1)).toEqual([PLANNING]);
    expect(getPlanTips(TIPS, 3)).toEqual([PLANNING, FAMILY]);
  });

  it("shows none without plan tips", () => {
    expect(getPlanTips([AVOCADO_STORAGE, UNTAGGED], 2)).toEqual([]);
    expect(getPlanTips([{ id: "family-only", tags: [HOUSEHOLD_TIP_TAG] }], 2)).toEqual([]);
  });
});

describe("getTipStartIndex", () => {
  it("is the same for the same seed and within the tips", () => {
    const seed = "55555555-5555-4555-8555-555555555555";
    const index = getTipStartIndex(seed, 5);
    expect(getTipStartIndex(seed, 5)).toBe(index);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(5);
  });

  it("takes turns between seeds", () => {
    const indexes = new Set(["a", "b", "c", "d", "e", "f", "g"].map((seed) => getTipStartIndex(seed, 5)));
    expect(indexes.size).toBeGreaterThan(1);
  });

  it("is 0 without tips or for an empty seed", () => {
    expect(getTipStartIndex("plan", 0)).toBe(0);
    expect(getTipStartIndex("", 4)).toBe(0);
  });
});
