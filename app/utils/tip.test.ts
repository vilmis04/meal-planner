import { describe, expect, it } from "vitest";
import { getLocalizedTipIngredientName, getLocalizedTipText, tipIngredientRowsSchema, tipRowsSchema } from "./tip";

const TIP_ID = "00000000-0000-4000-8000-000000000001";
const AVOCADO_ID = "00000000-0000-4000-8000-000000000002";

const tipRow = {
  id: TIP_ID,
  tip: "Kaip avokado pusę išlaikyti nepajuodavusią…",
  tags: ["avocado", "storage"],
  tip_translations: [
    { locale: "lt", tip: "Kaip avokado pusę išlaikyti nepajuodavusią…" },
    { locale: "en", tip: "To keep half an avocado from browning…" },
  ],
};

const ingredientRow = {
  id: AVOCADO_ID,
  name: "Avokadas",
  tip_tags: ["avocado"],
  ingredient_translations: [
    { locale: "lt", name: "Avokadas" },
    { locale: "en", name: "Avocado" },
  ],
  ingredient_aliases: [{ item: "Avokadas" }, { item: "Avokadas (pusė)" }],
};

describe("tipRowsSchema", () => {
  it("keeps the source text, the tags and every language's text", () => {
    expect(tipRowsSchema.parse([tipRow])).toEqual([
      { id: TIP_ID, sourceText: tipRow.tip, tags: ["avocado", "storage"], texts: tipRow.tip_translations },
    ]);
  });

  it("refuses a row without its tags", () => {
    expect(tipRowsSchema.safeParse([{ ...tipRow, tags: null }]).success).toBe(false);
  });
});

describe("tipIngredientRowsSchema", () => {
  it("keeps the names, the tip tags and the aliases", () => {
    expect(tipIngredientRowsSchema.parse([ingredientRow])).toEqual([
      {
        id: AVOCADO_ID,
        sourceName: "Avokadas",
        names: ingredientRow.ingredient_translations,
        tipTags: ["avocado"],
        aliases: ["Avokadas", "Avokadas (pusė)"],
      },
    ]);
  });

  it("refuses a row without its aliases", () => {
    const { ingredient_aliases: _aliases, ...withoutAliases } = ingredientRow;
    expect(tipIngredientRowsSchema.safeParse([withoutAliases]).success).toBe(false);
  });
});

describe("getLocalizedTipText", () => {
  const [tip] = tipRowsSchema.parse([tipRow]);

  it("shows the tip in the viewer's language", () => {
    expect(getLocalizedTipText(tip!, "en")).toBe("To keep half an avocado from browning…");
    expect(getLocalizedTipText(tip!, "lt")).toBe(tipRow.tip);
  });

  it("falls back to Lithuanian, then to the source text", () => {
    expect(getLocalizedTipText({ ...tip!, texts: [tipRow.tip_translations[0]!] }, "en")).toBe(tipRow.tip);
    expect(getLocalizedTipText({ ...tip!, texts: [] }, "en")).toBe(tipRow.tip);
  });
});

describe("getLocalizedTipIngredientName", () => {
  const [ingredient] = tipIngredientRowsSchema.parse([ingredientRow]);

  it("names the ingredient in the viewer's language, else as stored", () => {
    expect(getLocalizedTipIngredientName(ingredient!, "en")).toBe("Avocado");
    expect(getLocalizedTipIngredientName({ ...ingredient!, names: [] }, "en")).toBe("Avokadas");
  });
});
