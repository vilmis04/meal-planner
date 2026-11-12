import { describe, expect, it } from "vitest";
import { localizeRecipe, localizeRecipeList, recipeDetailRowSchema, recipeListRowsSchema } from "./recipe";

const CHILI_ID = "00000000-0000-4000-8000-000000000001";
const SALAD_ID = "00000000-0000-4000-8000-000000000002";

const listRow = (id: string, name: string, translations: { locale: string; name: string }[]) => ({
  id,
  name,
  meal_type: "lunch",
  portion_days: 1,
  main_proteins: ["beef"],
  recipe_translations: translations,
});

const detailRow = {
  id: CHILI_ID,
  name: "Jautienos čili troškinys",
  meal_type: "lunch",
  instructions: "Mėsą apkepti.",
  portion_days: 2,
  main_proteins: ["beef"],
  recipe_translations: [
    { locale: "lt", name: "Jautienos čili troškinys", instructions: "Mėsą apkepti." },
    { locale: "en", name: "Beef chilli stew", instructions: "Brown the meat." },
  ],
  recipe_ingredients: [
    {
      position: 2,
      item: "Laimas",
      amount: 1,
      unit: "skiltelė",
      recipe_ingredient_translations: [
        { locale: "lt", item: "Laimas", unit: null },
        { locale: "en", item: "Lime", unit: "wedge" },
      ],
    },
    {
      position: 1,
      item: "Česnakas",
      amount: 2,
      unit: "skiltelė",
      recipe_ingredient_translations: [{ locale: "lt", item: "Česnakas", unit: null }],
    },
  ],
};

describe("localizeRecipeList", () => {
  const entries = recipeListRowsSchema.parse([
    listRow(CHILI_ID, "Jautienos čili troškinys", [
      { locale: "lt", name: "Jautienos čili troškinys" },
      { locale: "en", name: "Beef chilli stew" },
    ]),
    listRow(SALAD_ID, "Graikiškos salotos", [{ locale: "lt", name: "Graikiškos salotos" }]),
  ]);

  it("names each recipe in the active language, sorted in it", () => {
    expect(localizeRecipeList(entries, "en").map((recipe) => recipe.name)).toEqual([
      "Beef chilli stew",
      "Graikiškos salotos",
    ]);
    expect(localizeRecipeList(entries, "lt").map((recipe) => recipe.name)).toEqual([
      "Graikiškos salotos",
      "Jautienos čili troškinys",
    ]);
  });

  it("falls back to the source name without translation rows", () => {
    const [entry] = recipeListRowsSchema.parse([listRow(SALAD_ID, "Graikiškos salotos", [])]);
    expect(localizeRecipeList([entry!], "en")[0]).toEqual({
      id: SALAD_ID,
      name: "Graikiškos salotos",
      mealType: "lunch",
      portionDays: 1,
      mainProteins: ["beef"],
    });
  });
});

describe("localizeRecipe", () => {
  const content = recipeDetailRowSchema.parse(detailRow);

  it("shows the recipe in the active language, lines in position order", () => {
    expect(localizeRecipe(content, "en")).toEqual({
      id: CHILI_ID,
      name: "Beef chilli stew",
      mealType: "lunch",
      instructions: "Brown the meat.",
      portionDays: 2,
      mainProteins: ["beef"],
      ingredients: [
        { position: 1, item: "Česnakas", amount: 2, unit: "skiltelė" },
        { position: 2, item: "Lime", amount: 1, unit: "wedge" },
      ],
    });
  });

  it("keeps Lithuanian, with stored units, in Lithuanian", () => {
    const recipe = localizeRecipe(content, "lt");
    expect(recipe.name).toBe("Jautienos čili troškinys");
    expect(recipe.ingredients.map((ingredient) => [ingredient.item, ingredient.unit])).toEqual([
      ["Česnakas", "skiltelė"],
      ["Laimas", "skiltelė"],
    ]);
  });

  it("falls back to the Lithuanian instructions when a translation has none", () => {
    const withoutInstructions = recipeDetailRowSchema.parse({
      ...detailRow,
      recipe_translations: [{ locale: "en", name: "Beef chilli stew", instructions: "" }],
    });
    expect(localizeRecipe(withoutInstructions, "en").instructions).toBe("Mėsą apkepti.");
  });
});
