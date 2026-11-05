import { describe, expect, it } from "vitest";
import type { Protein } from "./diet";
import {
  CLAIM_TTL_MS,
  PROMPT_VERSION,
  buildSwapPrompt,
  conflictingDiets,
  excludedProteins,
  nextRetryAfter,
  swapCacheDecision,
  swappedProteins,
  validateSwap,
} from "./proteinSwap";
import { SWAP_RESPONSE_JSON_SCHEMA } from "./proteinSwap.schema";
import type { StoredSwapState, SwapRecipe } from "./proteinSwap.types";

function recipe(mainProteins: Protein[], overrides: Partial<SwapRecipe> = {}): SwapRecipe {
  return {
    id: "r1",
    name: "Vištiena su bulvėmis orkaitėje",
    mainProteins,
    ingredients: [
      { id: "i1", position: 1, item: "Vištienos filė", amount: 120, unit: "g" },
      { id: "i2", position: 2, item: "Bulvės", amount: 200, unit: "g" },
      { id: "i3", position: 3, item: "Druska", amount: null, unit: null },
    ],
    nutrition: { caloriesKcal: 450, carbohydrates: 40, protein: 35, fat: 12 },
    ...overrides,
  };
}

const chicken = recipe(["poultry"]);

function answer(swaps: unknown[], extra: Record<string, unknown> = {}) {
  return {
    swaps,
    note: "Sojų gabaliukus išmirkyti 10 min.",
    nutrition: { calories_kcal: 430, carbohydrates: 42, protein: 30, fat: 11 },
    ...extra,
  };
}

const soyChunks = {
  position: 1,
  original_protein: "poultry",
  item: "Sojų gabaliukai",
  amount: 60,
  unit: "g",
  replacement_protein: "plant",
};

describe("which diets need a swap", () => {
  it.each<[Protein[], string[]]>([
    [["beef"], ["vegetarian", "fish", "poultry", "pork"]],
    [["pork"], ["vegetarian", "fish", "poultry"]],
    [["poultry"], ["vegetarian", "fish"]],
    [["fish"], ["vegetarian"]],
    [["pork", "poultry"], ["vegetarian", "fish", "poultry"]],
    [["egg_dairy"], []],
    [["plant"], []],
    [["other_meat"], ["vegetarian", "fish", "poultry", "pork", "beef"]],
  ])("%j conflicts with %j", (proteins, diets) => {
    expect(conflictingDiets(proteins)).toEqual(diets);
  });

  it("names only the proteins the diet excludes", () => {
    expect(excludedProteins("poultry", ["pork", "poultry"])).toEqual(["pork"]);
    expect(excludedProteins("vegetarian", ["pork", "poultry"])).toEqual(["pork", "poultry"]);
  });

  it("works out the proteins after a swap", () => {
    expect(
      swappedProteins(["pork", "poultry"], [{ originalProtein: "pork", replacementProtein: "egg_dairy" }]).sort(),
    ).toEqual(["egg_dairy", "poultry"]);
  });
});

describe("the prompt", () => {
  it("lists the ingredients with positions, amounts and units, and the diet's rules", () => {
    const prompt = buildSwapPrompt(chicken, "vegetarian");
    expect(prompt).toContain("Recipe: Vištiena su bulvėmis orkaitėje");
    expect(prompt).toContain("1. Vištienos filė: 120 g");
    expect(prompt).toContain("3. Druska: pagal skonį (to taste)");
    expect(prompt).toContain("does NOT allow: paukštiena (poultry)");
    expect(prompt).toContain("egg_dairy =");
    expect(prompt).toContain("plant =");
    expect(prompt).not.toContain("fish = ");
    expect(prompt).toContain("450 kcal");
  });

  it("carries the last answer's errors on a retry", () => {
    const prompt = buildSwapPrompt(chicken, "vegetarian", ["position 9: the recipe has no ingredient at this position"]);
    expect(prompt).toContain("Your previous answer was rejected");
    expect(prompt).toContain("- position 9: the recipe has no ingredient at this position");
  });

  it("asks for every field the validator reads", () => {
    const item = SWAP_RESPONSE_JSON_SCHEMA.properties.swaps.items;
    expect([...item.required].sort()).toEqual(Object.keys(item.properties).sort());
    expect([...SWAP_RESPONSE_JSON_SCHEMA.required]).toEqual(["swaps", "note", "nutrition"]);
  });
});

describe("validating an answer", () => {
  it("accepts chicken to soy chunks for a vegetarian", () => {
    const result = validateSwap(chicken, "vegetarian", answer([soyChunks]));
    expect(result).toEqual({
      ok: true,
      swap: {
        items: [
          {
            recipeIngredientId: "i1",
            position: 1,
            originalProtein: "poultry",
            item: "Sojų gabaliukai",
            amount: 60,
            unit: "g",
            replacementProtein: "plant",
          },
        ],
        note: "Sojų gabaliukus išmirkyti 10 min.",
        nutrition: { caloriesKcal: 430, carbohydrates: 42, protein: 30, fat: 11 },
      },
    });
  });

  it("accepts chicken to white fish for a fish diet", () => {
    const fish = { ...soyChunks, item: "Menkės filė", amount: 120, replacement_protein: "fish" };
    expect(validateSwap(chicken, "fish", answer([fish])).ok).toBe(true);
  });

  it("rejects a shape that does not match the schema", () => {
    const result = validateSwap(chicken, "vegetarian", { swaps: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/swaps|note|nutrition/);
    expect(validateSwap(chicken, "vegetarian", "not an object").ok).toBe(false);
  });

  it("rejects an ingredient that is not in the recipe", () => {
    const result = validateSwap(chicken, "vegetarian", answer([{ ...soyChunks, position: 9 }]));
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.errors).toContain("position 9: the recipe has no ingredient at this position");
  });

  it("rejects the same ingredient replaced twice", () => {
    const result = validateSwap(chicken, "vegetarian", answer([soyChunks, soyChunks]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("position 1: replaced more than once");
  });

  it("rejects a replacement protein the diet does not allow", () => {
    const fish = { ...soyChunks, item: "Menkės filė", replacement_protein: "fish" };
    const result = validateSwap(chicken, "vegetarian", answer([fish]));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("position 1: replacement_protein fish is not allowed by the vegetarian diet");
    }
  });

  it("rejects a meat named as a plant replacement", () => {
    const result = validateSwap(chicken, "vegetarian", answer([{ ...soyChunks, item: "Kalakutienos kumpis" }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("reads as poultry");
  });

  it("lets a plant-based imitation through", () => {
    expect(validateSwap(chicken, "vegetarian", answer([{ ...soyChunks, item: "Augalinė vištiena" }])).ok).toBe(true);
  });

  it("rejects a swap that leaves an excluded protein in the recipe", () => {
    const blt = recipe(["pork", "poultry"], {
      ingredients: [
        { id: "b1", position: 1, item: "Šoninė", amount: 30, unit: "g" },
        { id: "b2", position: 2, item: "Vištienos krūtinėlė", amount: 80, unit: "g" },
      ],
    });
    const onlyBacon = { position: 1, original_protein: "pork", item: "Halloumi sūris", amount: 30, unit: "g", replacement_protein: "egg_dairy" };
    const result = validateSwap(blt, "vegetarian", answer([onlyBacon]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("every excluded protein needs a replacement; missing: poultry");

    // For a poultry diet only the bacon has to go.
    expect(validateSwap(blt, "poultry", answer([onlyBacon])).ok).toBe(true);
  });

  it("rejects replacing a protein the diet already allows", () => {
    const blt = recipe(["pork", "poultry"], {
      ingredients: [
        { id: "b1", position: 1, item: "Šoninė", amount: 30, unit: "g" },
        { id: "b2", position: 2, item: "Vištienos krūtinėlė", amount: 80, unit: "g" },
      ],
    });
    const bacon = { position: 1, original_protein: "pork", item: "Halloumi sūris", amount: 30, unit: "g", replacement_protein: "egg_dairy" };
    const chickenToTofu = { position: 2, original_protein: "poultry", item: "Tofu", amount: 80, unit: "g", replacement_protein: "plant" };
    const result = validateSwap(blt, "poultry", answer([bacon, chickenToTofu]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("original_protein must be one the diet excludes (pork)");
  });

  it("requires amount and unit together", () => {
    const result = validateSwap(chicken, "vegetarian", answer([{ ...soyChunks, unit: null }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("amount and unit must both be set");
    expect(validateSwap(chicken, "vegetarian", answer([{ ...soyChunks, amount: null, unit: null }])).ok).toBe(true);
  });

  it("rejects amounts that are not positive or far above the original", () => {
    expect(validateSwap(chicken, "vegetarian", answer([{ ...soyChunks, amount: 0 }])).ok).toBe(false);
    const huge = validateSwap(chicken, "vegetarian", answer([{ ...soyChunks, amount: 500 }]));
    expect(huge.ok).toBe(false);
    if (!huge.ok) expect(huge.errors.join(" ")).toContain("more than 3x the original amount");
    // A different unit is not compared.
    expect(validateSwap(chicken, "vegetarian", answer([{ ...soyChunks, amount: 2, unit: "vnt." }])).ok).toBe(true);
  });

  it("rejects an empty or long item name and a long note", () => {
    expect(validateSwap(chicken, "vegetarian", answer([{ ...soyChunks, item: "  " }])).ok).toBe(false);
    expect(validateSwap(chicken, "vegetarian", answer([{ ...soyChunks, item: "x".repeat(121) }])).ok).toBe(false);
    expect(validateSwap(chicken, "vegetarian", answer([soyChunks], { note: "x".repeat(301) })).ok).toBe(false);
  });

  it("trims names and units and turns an empty note into null", () => {
    const result = validateSwap(chicken, "vegetarian", answer([{ ...soyChunks, item: " Tofu ", unit: " g " }], { note: " " }));
    expect(result).toMatchObject({ ok: true, swap: { note: null, items: [{ item: "Tofu", unit: "g" }] } });
  });

  describe("nutrition", () => {
    it("keeps a plausible estimate, rounded", () => {
      const result = validateSwap(
        chicken,
        "vegetarian",
        answer([soyChunks], { nutrition: { calories_kcal: 431.456, carbohydrates: 42, protein: 30, fat: 11 } }),
      );
      expect(result).toMatchObject({ ok: true, swap: { nutrition: { caloriesKcal: 431.46 } } });
    });

    it.each([
      ["far below the original", { calories_kcal: 200, carbohydrates: 42, protein: 30, fat: 11 }],
      ["far above the original", { calories_kcal: 700, carbohydrates: 42, protein: 30, fat: 11 }],
      ["negative", { calories_kcal: 430, carbohydrates: -1, protein: 30, fat: 11 }],
      ["incomplete", { calories_kcal: 430, carbohydrates: null, protein: 30, fat: 11 }],
    ])("drops an estimate that is %s, but keeps the swap", (_label, nutrition) => {
      const result = validateSwap(chicken, "vegetarian", answer([soyChunks], { nutrition }));
      expect(result).toMatchObject({ ok: true, swap: { nutrition: null } });
    });

    it("drops a missing estimate", () => {
      expect(validateSwap(chicken, "vegetarian", answer([soyChunks], { nutrition: null }))).toMatchObject({
        ok: true,
        swap: { nutrition: null },
      });
    });

    it("bounds the estimate when the original is unknown", () => {
      const unknown = recipe(["poultry"], { nutrition: { caloriesKcal: null, carbohydrates: null, protein: null, fat: null } });
      const sane = validateSwap(unknown, "vegetarian", answer([soyChunks]));
      expect(sane).toMatchObject({ ok: true, swap: { nutrition: { caloriesKcal: 430 } } });
      const wild = validateSwap(
        unknown,
        "vegetarian",
        answer([soyChunks], { nutrition: { calories_kcal: 5000, carbohydrates: 1, protein: 1, fat: 1 } }),
      );
      expect(wild).toMatchObject({ ok: true, swap: { nutrition: null } });
    });
  });
});

describe("the cache decision", () => {
  const now = new Date("2026-11-05T10:00:00Z");
  const current = { sourceHash: "h1", promptVersion: PROMPT_VERSION };
  const row = (overrides: Partial<StoredSwapState>): StoredSwapState => ({
    status: "ready",
    claimedAt: null,
    retryAfter: null,
    sourceHash: "h1",
    promptVersion: PROMPT_VERSION,
    ...overrides,
  });

  it("generates when nothing is stored", () => {
    expect(swapCacheDecision(null, current, now)).toEqual({ action: "generate" });
  });

  it("serves a ready swap made from the current recipe", () => {
    expect(swapCacheDecision(row({}), current, now)).toEqual({ action: "hit" });
  });

  it("regenerates a ready swap when the ingredients or the prompt changed", () => {
    expect(swapCacheDecision(row({ sourceHash: "old" }), current, now)).toEqual({ action: "generate" });
    expect(swapCacheDecision(row({ promptVersion: PROMPT_VERSION - 1 }), current, now)).toEqual({ action: "generate" });
  });

  it("waits for a fresh claim and takes over an expired one", () => {
    const fresh = new Date(now.getTime() - CLAIM_TTL_MS + 1000);
    const expired = new Date(now.getTime() - CLAIM_TTL_MS - 1000);
    expect(swapCacheDecision(row({ status: "pending", claimedAt: fresh }), current, now)).toEqual({ action: "wait" });
    expect(swapCacheDecision(row({ status: "pending", claimedAt: expired }), current, now)).toEqual({ action: "generate" });
  });

  it("keeps a failed pair unavailable until its retry time", () => {
    const later = new Date(now.getTime() + 60_000);
    expect(swapCacheDecision(row({ status: "failed", retryAfter: later }), current, now)).toEqual({
      action: "unavailable",
      retryAfter: later,
    });
    expect(swapCacheDecision(row({ status: "failed", retryAfter: now }), current, now)).toEqual({ action: "generate" });
  });

  it("regenerates a rejected swap", () => {
    expect(swapCacheDecision(row({ status: "rejected" }), current, now)).toEqual({ action: "generate" });
  });

  it("waits longer after each failure", () => {
    const minutes = (attempts: number) => (nextRetryAfter(attempts, now).getTime() - now.getTime()) / 60_000;
    expect([1, 2, 3, 7].map(minutes)).toEqual([5, 60, 1440, 1440]);
  });
});
