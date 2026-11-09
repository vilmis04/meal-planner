import type { ShoppingItem } from "#shared/utils/shoppingList.types";

interface ShoppingList {
  id: string;
  missingSwapCount: number;
  items: ShoppingItem[];
}

export type ShoppingListLoadResult = { status: "found"; list: ShoppingList } | { status: "not-found" } | { status: "failed" };

// List id → group key → whether this viewer opened (true) or closed (false) the group, as saved on this device (G3).
export type StoredGroupExpansion = Record<string, Record<string, boolean>>;

// The fields of a line people change (G4), as the page applies them before the database confirms.
export type ShoppingItemPatch = Partial<Pick<ShoppingItem, "state" | "isRemoved" | "amountOverride" | "amount" | "unit">>;

// What a change to a list resolves to; errorKey is the message to show when nothing was saved.
export type ShoppingItemEditResult = { isSaved: true } | { isSaved: false; errorKey: string };
