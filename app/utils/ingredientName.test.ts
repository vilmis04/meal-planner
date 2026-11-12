import { describe, expect, it } from "vitest";
import { getLocalizedIngredientName, ingredientNameRowsSchema } from "./ingredientName";

const EGGS_ID = "00000000-0000-4000-8000-000000000001";

describe("ingredientNameRowsSchema", () => {
  it("keeps the source name and every language's name", () => {
    const [entry] = ingredientNameRowsSchema.parse([
      {
        id: EGGS_ID,
        name: "Kiaušiniai",
        ingredient_translations: [
          { locale: "lt", name: "Kiaušiniai" },
          { locale: "en", name: "Eggs" },
        ],
      },
    ]);
    expect(entry).toEqual({
      id: EGGS_ID,
      sourceName: "Kiaušiniai",
      names: [
        { locale: "lt", name: "Kiaušiniai" },
        { locale: "en", name: "Eggs" },
      ],
    });
  });

  it("refuses a row without its translations", () => {
    expect(ingredientNameRowsSchema.safeParse([{ id: EGGS_ID, name: "Kiaušiniai" }]).success).toBe(false);
  });
});

describe("getLocalizedIngredientName", () => {
  const entry = { id: EGGS_ID, sourceName: "Kiaušiniai", names: [{ locale: "lt", name: "Kiaušiniai" }, { locale: "en", name: "Eggs" }] };

  it("names the ingredient in the viewer's language", () => {
    expect(getLocalizedIngredientName(entry, "en")).toBe("Eggs");
    expect(getLocalizedIngredientName(entry, "lt")).toBe("Kiaušiniai");
  });

  it("falls back to Lithuanian, then to the source name", () => {
    expect(getLocalizedIngredientName({ ...entry, names: [{ locale: "lt", name: "Kiaušiniai" }] }, "en")).toBe("Kiaušiniai");
    expect(getLocalizedIngredientName({ ...entry, names: [] }, "en")).toBe("Kiaušiniai");
  });
});
