import { describe, expect, it } from "vitest";
import { getLocalizedSwapItemName, swapItemNameRowsSchema } from "./swapItemName";

describe("swapItemNameRowsSchema", () => {
  it("groups the translations of each Lithuanian item", () => {
    const texts = swapItemNameRowsSchema.parse([
      { item: "Tofu", recipe_protein_swap_item_translations: [{ locale: "lt", item: "Tofu" }] },
      { item: "Augalinis faršas", recipe_protein_swap_item_translations: [{ locale: "en", item: "Plant-based mince" }] },
      { item: "Tofu", recipe_protein_swap_item_translations: [{ locale: "en", item: "Tofu" }] },
    ]);
    expect(texts.get("Tofu")).toEqual([
      { locale: "lt", item: "Tofu" },
      { locale: "en", item: "Tofu" },
    ]);
    expect(texts.get("Augalinis faršas")).toEqual([{ locale: "en", item: "Plant-based mince" }]);
  });

  it("rejects rows without their translations", () => {
    expect(swapItemNameRowsSchema.safeParse([{ item: "Tofu" }]).success).toBe(false);
  });
});

describe("getLocalizedSwapItemName", () => {
  const texts = [
    { locale: "lt", item: "Augalinis faršas" },
    { locale: "en", item: "Plant-based mince" },
  ];

  it("names the replacement in the viewer's language", () => {
    expect(getLocalizedSwapItemName(texts, "Augalinis faršas", "en")).toBe("Plant-based mince");
    expect(getLocalizedSwapItemName(texts, "Augalinis faršas", "lt")).toBe("Augalinis faršas");
  });

  it("falls back to Lithuanian, then to the stored name", () => {
    expect(getLocalizedSwapItemName([texts[0]!], "Augalinis faršas", "en")).toBe("Augalinis faršas");
    expect(getLocalizedSwapItemName(undefined, "Daržovių sultinys", "en")).toBe("Daržovių sultinys");
  });
});
