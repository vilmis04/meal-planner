import { describe, expect, it } from "vitest";
import { applySwap, keepsAmount, retryDelayMs, swapNeeded } from "./recipeSwap";
import type { IngredientLine, SwapReplacement } from "./recipeSwap.types";

const ingredients: IngredientLine[] = [
  { position: 1, item: "Avinžirniai", amount: 120, unit: "g" },
  { position: 2, item: "Vištienos šlaunelės", amount: 150, unit: "g" },
  { position: 3, item: "Kokosų pienas", amount: 100, unit: "ml" },
  { position: 4, item: "Druska", amount: null, unit: null },
];

const cod: SwapReplacement = {
  position: 2,
  original: { item: "Vištienos šlaunelės", amount: 150, unit: "g" },
  item: "Menkės filė",
  amount: 150,
  unit: "g",
};

describe("swapNeeded", () => {
  it("is true when the diet excludes a main protein", () => {
    expect(swapNeeded("fish", ["poultry", "plant"])).toBe(true);
    expect(swapNeeded("vegetarian", ["beef"])).toBe(true);
  });

  it("is false when the recipe fits the diet", () => {
    expect(swapNeeded("fish", ["fish", "egg_dairy"])).toBe(false);
    expect(swapNeeded("vegetarian", ["plant"])).toBe(false);
  });

  it("is false for the full diet and when no diet is known", () => {
    expect(swapNeeded("full", ["other_meat"])).toBe(false);
    expect(swapNeeded(null, ["beef"])).toBe(false);
    expect(swapNeeded(undefined, ["beef"])).toBe(false);
  });
});

describe("applySwap", () => {
  it("swaps the replaced line in place and keeps what it replaced", () => {
    const lines = applySwap(ingredients, [cod]);

    expect(lines.map((line) => line.item)).toEqual(["Avinžirniai", "Menkės filė", "Kokosų pienas", "Druska"]);
    expect(lines[1]).toEqual({
      position: 2,
      item: "Menkės filė",
      amount: 150,
      unit: "g",
      swapped: true,
      original: { item: "Vištienos šlaunelės", amount: 150, unit: "g" },
    });
  });

  it("leaves the other lines unmarked", () => {
    const lines = applySwap(ingredients, [cod]);

    expect(lines.filter((line) => line.swapped)).toHaveLength(1);
    expect(lines[0]).toEqual({ ...ingredients[0], swapped: false, original: null });
  });

  it("swaps several lines and ignores a replacement for a position the recipe no longer has", () => {
    const lines = applySwap(ingredients, [
      cod,
      { position: 4, original: { item: "Druska", amount: null, unit: null }, item: "Jūros druska", amount: null, unit: null },
      { position: 9, original: { item: "Kumpis", amount: 50, unit: "g" }, item: "Sūris", amount: 50, unit: "g" },
    ]);

    expect(lines).toHaveLength(4);
    expect(lines.map((line) => line.swapped)).toEqual([false, true, false, true]);
  });

  it("returns the recipe unchanged when there is nothing to replace", () => {
    expect(applySwap(ingredients, []).every((line) => !line.swapped)).toBe(true);
  });
});

describe("keepsAmount", () => {
  it("is true only for the same amount in the same unit", () => {
    expect(keepsAmount(cod)).toBe(true);
    expect(keepsAmount({ ...cod, amount: 120 })).toBe(false);
    expect(keepsAmount({ ...cod, unit: "vnt." })).toBe(false);
  });

  it("is false for to-taste lines", () => {
    expect(keepsAmount({ ...cod, amount: null, unit: null, original: { item: "x", amount: null, unit: null } })).toBe(
      false,
    );
  });
});

describe("retryDelayMs", () => {
  it("reads Retry-After seconds", () => {
    expect(retryDelayMs("3")).toBe(3000);
  });

  it("falls back to 3 s when the header is missing or not a number", () => {
    expect(retryDelayMs(null)).toBe(3000);
    expect(retryDelayMs("soon")).toBe(3000);
  });

  it("stays between 1 and 10 seconds", () => {
    expect(retryDelayMs("0")).toBe(1000);
    expect(retryDelayMs("120")).toBe(10_000);
  });
});
