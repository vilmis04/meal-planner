import { describe, expect, it } from "vitest";
import {
  remotePurchaseChangeSchema,
  remoteShoppingItemChangeSchema,
  remoteShoppingListChangeSchema,
} from "./shoppingListLive.schema";

const LIST_ID = "00000000-0000-4000-8000-0000000000b1";
const ITEM_ID = "00000000-0000-4000-8000-000000000001";

const row = {
  id: ITEM_ID,
  list_id: LIST_ID,
  source: "generated",
  generated_key: "ingredient:x|g",
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
  updated_at: "2026-11-09T10:00:00Z",
};

describe("remoteShoppingItemChangeSchema", () => {
  it("reads an added or changed line with its list", () => {
    const result = remoteShoppingItemChangeSchema.parse({ eventType: "UPDATE", new: row, old: { id: ITEM_ID } });

    expect(result).toEqual({
      kind: "upsert",
      listId: LIST_ID,
      item: expect.objectContaining({ id: ITEM_ID, state: "bought", amount: 300, isExtra: false }),
    });
  });

  it("reads a deleted line as its id", () => {
    expect(remoteShoppingItemChangeSchema.parse({ eventType: "DELETE", new: {}, old: { id: ITEM_ID } })).toEqual({
      kind: "delete",
      itemId: ITEM_ID,
    });
  });

  it("refuses a change it cannot read", () => {
    expect(remoteShoppingItemChangeSchema.safeParse({ eventType: "UPDATE", new: { ...row, state: "lost" } }).success).toBe(false);
    expect(remoteShoppingItemChangeSchema.safeParse({ eventType: "INSERT", new: { id: ITEM_ID } }).success).toBe(false);
  });
});

describe("remotePurchaseChangeSchema", () => {
  const SHOP_ID = "00000000-0000-4000-8000-0000000000a1";
  const purchaseRow = {
    item_id: ITEM_ID,
    list_id: LIST_ID,
    shop_id: SHOP_ID,
    bought_by: null,
    bought_at: "2026-11-09T10:00:00Z",
    amount: 300,
    unit: "g",
    updated_at: "2026-11-09T10:00:00Z",
  };

  it("reads an added or changed purchase as its line's purchase fields", () => {
    expect(remotePurchaseChangeSchema.parse({ eventType: "INSERT", new: purchaseRow, old: {} })).toEqual({
      kind: "purchase_upsert",
      listId: LIST_ID,
      itemId: ITEM_ID,
      purchase: { shopId: SHOP_ID, boughtAmount: 300, boughtUnit: "g" },
    });
  });

  it("reads a deleted purchase as its line's id", () => {
    expect(remotePurchaseChangeSchema.parse({ eventType: "DELETE", new: {}, old: { item_id: ITEM_ID } })).toEqual({
      kind: "purchase_delete",
      itemId: ITEM_ID,
    });
  });

  it("refuses a purchase it cannot read", () => {
    expect(remotePurchaseChangeSchema.safeParse({ eventType: "UPDATE", new: { ...purchaseRow, shop_id: "Lidl" } }).success).toBe(false);
    expect(remotePurchaseChangeSchema.safeParse({ eventType: "DELETE", old: { id: ITEM_ID } }).success).toBe(false);
  });
});

describe("remoteShoppingListChangeSchema", () => {
  it("reads the list's versions", () => {
    const result = remoteShoppingListChangeSchema.parse({
      eventType: "UPDATE",
      new: { id: LIST_ID, plan_id: ITEM_ID, source_version: 4, generated_version: 3, missing_swap_count: 1 },
    });

    expect(result).toEqual({ listId: LIST_ID, sourceVersion: 4, generatedVersion: 3, missingSwapCount: 1 });
  });
});
