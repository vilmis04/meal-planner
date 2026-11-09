import type { ShoppingItem } from "#shared/utils/shoppingList.types";

interface ShoppingList {
  id: string;
  missingSwapCount: number;
  items: ShoppingItem[];
}

export type ShoppingListLoadResult = { status: "found"; list: ShoppingList } | { status: "not-found" } | { status: "failed" };

// List id → group key → whether this viewer opened (true) or closed (false) the group, as saved on this device (G3).
export type StoredGroupExpansion = Record<string, Record<string, boolean>>;
