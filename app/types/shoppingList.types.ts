import type { ShoppingItem } from "#shared/utils/shoppingList.types";

interface ShoppingList {
  id: string;
  missingSwapCount: number;
  items: ShoppingItem[];
}

export type ShoppingListLoadResult = { status: "found"; list: ShoppingList } | { status: "not-found" } | { status: "failed" };
