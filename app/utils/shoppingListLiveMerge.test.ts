import { describe, expect, it } from "vitest";
import {
  applyRemoteShoppingItemChange,
  isShoppingListCatchUpNeeded,
  mergeStoredShoppingItems,
} from "./shoppingListLiveMerge";
import type { ShoppingItem } from "#shared/utils/shoppingList.types";
import type { ShoppingItemGuardedField } from "~/types/shoppingList.types";

const item = (id: string, overrides: Partial<ShoppingItem> = {}): ShoppingItem => ({
  id,
  source: "generated",
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
  ...overrides,
});

const guarding =
  (guarded: Record<string, ShoppingItemGuardedField[]>) =>
  (itemId: string): ReadonlySet<ShoppingItemGuardedField> =>
    new Set(guarded[itemId] ?? []);

describe("applyRemoteShoppingItemChange", () => {
  it("applies another member's change to a line", () => {
    const items = [item("a"), item("b")];

    const changed = applyRemoteShoppingItemChange(
      items,
      { kind: "upsert", listId: "list", item: item("b", { state: "bought" }) },
      guarding({}),
    );

    expect(changed.map((line) => line.state)).toEqual(["to_buy", "bought"]);
  });

  it("keeps the fields this viewer has on the way and takes the others", () => {
    const items = [item("a", { state: "bought" })];

    const changed = applyRemoteShoppingItemChange(
      items,
      { kind: "upsert", listId: "list", item: item("a", { state: "to_buy", amountOverride: 800 }) },
      guarding({ a: ["state"] }),
    );

    expect(changed[0]).toMatchObject({ state: "bought", amountOverride: 800 });
  });

  it("adds a line another member added", () => {
    const changed = applyRemoteShoppingItemChange(
      [item("a")],
      { kind: "upsert", listId: "list", item: item("c", { source: "manual" }) },
      guarding({}),
    );

    expect(changed.map((line) => line.id)).toEqual(["a", "c"]);
  });

  it("does not bring back a line this viewer is deleting", () => {
    const changed = applyRemoteShoppingItemChange(
      [item("a")],
      { kind: "upsert", listId: "list", item: item("c") },
      guarding({ c: ["isPresent"] }),
    );

    expect(changed.map((line) => line.id)).toEqual(["a"]);
  });

  it("drops a deleted line, and ignores ids it does not show", () => {
    const items = [item("a"), item("b")];

    expect(applyRemoteShoppingItemChange(items, { kind: "delete", itemId: "a" }, guarding({})).map((line) => line.id)).toEqual(["b"]);
    expect(applyRemoteShoppingItemChange(items, { kind: "delete", itemId: "x" }, guarding({}))).toEqual(items);
  });

  it("keeps a line this viewer is adding again when its earlier deletion arrives", () => {
    const changed = applyRemoteShoppingItemChange(
      [item("a")],
      { kind: "delete", itemId: "a" },
      guarding({ a: ["isPresent"] }),
    );

    expect(changed.map((line) => line.id)).toEqual(["a"]);
  });
});

describe("mergeStoredShoppingItems", () => {
  it("takes the stored lines when nothing is on the way", () => {
    const stored = [item("a", { state: "bought" }), item("b")];

    expect(mergeStoredShoppingItems([item("a"), item("c")], stored, guarding({}))).toEqual(stored);
  });

  it("keeps guarded fields, lines being added and leaves out lines being deleted", () => {
    const local = [item("a", { state: "bought" }), item("new", { source: "manual" })];
    const stored = [item("a", { amountOverride: 300 }), item("gone")];

    const merged = mergeStoredShoppingItems(local, stored, guarding({ a: ["state"], new: ["isPresent"], gone: ["isPresent"] }));

    expect(merged.map((line) => line.id)).toEqual(["a", "new"]);
    expect(merged[0]).toMatchObject({ state: "bought", amountOverride: 300 });
  });
});

describe("isShoppingListCatchUpNeeded", () => {
  const change = { listId: "list", sourceVersion: 3, generatedVersion: 3, missingSwapCount: 0 };

  it("is needed when the list is behind the plan", () => {
    expect(isShoppingListCatchUpNeeded({ ...change, sourceVersion: 4 }, 0)).toBe(true);
  });

  it("is needed when a rebuild changed the missing swaps", () => {
    expect(isShoppingListCatchUpNeeded({ ...change, missingSwapCount: 2 }, 0)).toBe(true);
  });

  it("is not needed for a rebuild the page already shows", () => {
    expect(isShoppingListCatchUpNeeded(change, 0)).toBe(false);
  });
});
