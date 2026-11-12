import { describe, expect, it } from "vitest";
import { getPatchedFields, patchShoppingItem } from "./shoppingItemPatch";
import type { ShoppingItem } from "#shared/utils/shoppingList.types";

const item = (id: string, overrides: Partial<ShoppingItem> = {}): ShoppingItem => ({
  id,
  source: "generated",
  ingredientId: null,
  name: id,
  category: "other",
  amount: 100,
  unit: "g",
  isExtra: false,
  swappedFor: [],
  inPlan: true,
  state: "to_buy",
  isRemoved: false,
  amountOverride: null,
  addedBy: null,
  shopId: null,
  boughtAmount: null,
  boughtUnit: null,
  ...overrides,
});

describe("patchShoppingItem", () => {
  it("changes the given fields of one line and leaves the others", () => {
    const items = [item("a"), item("b")];

    const patched = patchShoppingItem(items, "b", { state: "have_at_home" });

    expect(patched.map((line) => line.state)).toEqual(["to_buy", "have_at_home"]);
    expect(patched[0]).toBe(items[0]);
    expect(items[1]?.state).toBe("to_buy");
  });
});

describe("getPatchedFields", () => {
  it("returns what the patched fields held", () => {
    expect(getPatchedFields(item("a", { amountOverride: 50 }), { amountOverride: 80, state: "have_at_home" })).toEqual({
      amountOverride: 50,
      state: "to_buy",
    });
  });
});
