import { describe, expect, it } from "vitest";
import { DIETS, PROTEINS, allowedProteins, isProtein, isProteinAllowed, isRecipeCompatible } from "./diet";

// Written out here on purpose: this is the ladder as the story and the README describe it.
const EXPECTED: Record<string, string[]> = {
  vegetarian: ["egg_dairy", "plant"],
  fish: ["egg_dairy", "plant", "fish"],
  poultry: ["egg_dairy", "plant", "fish", "poultry"],
  pork: ["egg_dairy", "plant", "fish", "poultry", "pork"],
  beef: ["egg_dairy", "plant", "fish", "poultry", "pork", "beef"],
  full: ["egg_dairy", "plant", "fish", "poultry", "pork", "beef", "other_meat"],
};

describe("diet ladder", () => {
  it("lists the six diets from lowest to highest", () => {
    expect([...DIETS]).toEqual(["vegetarian", "fish", "poultry", "pork", "beef", "full"]);
  });

  it.each(DIETS)("%s allows the proteins of its own and every earlier step", (diet) => {
    expect([...allowedProteins(diet)].sort()).toEqual([...EXPECTED[diet]!].sort());
  });

  it("never allows a protein twice", () => {
    for (const diet of DIETS) {
      const allowed = allowedProteins(diet);
      expect(new Set(allowed).size).toBe(allowed.length);
    }
  });

  it("makes every diet a superset of the one before it", () => {
    DIETS.slice(1).forEach((diet, index) => {
      const lower = allowedProteins(DIETS[index]!);
      expect(allowedProteins(diet)).toEqual(expect.arrayContaining([...lower]));
      expect(allowedProteins(diet).length).toBeGreaterThan(lower.length);
    });
  });

  it("lets full allow every protein", () => {
    expect([...allowedProteins("full")].sort()).toEqual([...PROTEINS].sort());
  });

  it("answers per protein", () => {
    expect(isProteinAllowed("vegetarian", "plant")).toBe(true);
    expect(isProteinAllowed("vegetarian", "fish")).toBe(false);
    expect(isProteinAllowed("pork", "poultry")).toBe(true);
    expect(isProteinAllowed("pork", "beef")).toBe(false);
    expect(isProteinAllowed("beef", "other_meat")).toBe(false);
    expect(isProteinAllowed("full", "other_meat")).toBe(true);
  });
});

describe("recipe compatibility", () => {
  it.each(DIETS.flatMap((diet) => PROTEINS.map((protein) => [diet, protein] as const)))(
    "a %s diet and a %s recipe agree with the ladder",
    (diet, protein) => {
      expect(isRecipeCompatible(diet, [protein])).toBe(EXPECTED[diet]!.includes(protein));
    },
  );

  it("needs every main protein to be allowed", () => {
    expect(isRecipeCompatible("pork", ["pork", "poultry"])).toBe(true);
    expect(isRecipeCompatible("poultry", ["pork", "poultry"])).toBe(false);
    expect(isRecipeCompatible("fish", ["fish", "egg_dairy"])).toBe(true);
  });

  it("fits egg/dairy and plant recipes to every diet", () => {
    for (const diet of DIETS) {
      expect(isRecipeCompatible(diet, ["egg_dairy"])).toBe(true);
      expect(isRecipeCompatible(diet, ["plant"])).toBe(true);
    }
  });

  it("fits an untagged recipe to full only", () => {
    expect(DIETS.filter((diet) => isRecipeCompatible(diet, []))).toEqual(["full"]);
  });

  it("recognises the protein vocabulary", () => {
    for (const protein of PROTEINS) expect(isProtein(protein)).toBe(true);
    expect(isProtein("lamb")).toBe(false);
    expect(isProtein("Fish")).toBe(false);
    expect(isProtein("")).toBe(false);
  });
});
