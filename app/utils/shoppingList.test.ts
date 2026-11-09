import { describe, expect, it } from "vitest";
import { shoppingListRowSchema } from "./shoppingList";

const LIST_ID = "00000000-0000-4000-8000-0000000000b1";
const ITEM_ID = "00000000-0000-4000-8000-000000000001";
const SHOP_ID = "00000000-0000-4000-8000-0000000000a1";

const itemRow = {
  id: ITEM_ID,
  source: "generated",
  name: "Svogūnai",
  category: "fruit_and_vegetables",
  amount: 300,
  unit: "g",
  is_extra: false,
  swapped_for: [],
  in_plan: true,
  state: "bought",
  is_removed: false,
  amount_override: null,
  added_by: null,
};
const listRow = (purchases: unknown) => ({
  id: LIST_ID,
  source_version: 2,
  generated_version: 2,
  missing_swap_count: 0,
  shopping_items: [{ ...itemRow, purchases }],
});

describe("shoppingListRowSchema", () => {
  it("reads a bought line's purchase into the line", () => {
    const list = shoppingListRowSchema.parse(listRow({ shop_id: SHOP_ID, amount: 250, unit: "g" }));

    expect(list.items[0]).toMatchObject({ id: ITEM_ID, shopId: SHOP_ID, boughtAmount: 250, boughtUnit: "g" });
  });

  it("reads a line without a purchase, embedded as null or as an empty list", () => {
    const empty = { shopId: null, boughtAmount: null, boughtUnit: null };

    expect(shoppingListRowSchema.parse(listRow(null)).items[0]).toMatchObject(empty);
    expect(shoppingListRowSchema.parse(listRow([])).items[0]).toMatchObject(empty);
    expect(shoppingListRowSchema.parse(listRow([{ shop_id: null, amount: null, unit: null }])).items[0]).toMatchObject(empty);
  });

  it("refuses a purchase it cannot read", () => {
    expect(shoppingListRowSchema.safeParse(listRow({ shop_id: "Lidl", amount: 1, unit: "g" })).success).toBe(false);
  });
});
