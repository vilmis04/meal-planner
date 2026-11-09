import type { ShoppingListStore } from "./shoppingListStore.types";

export interface ShoppingListServiceDependencies {
  store: ShoppingListStore;
}

export type RefreshShoppingListResult =
  | { status: "up-to-date" }
  | { status: "refreshed"; itemCount: number; missingSwapCount: number }
  // The plan kept changing while the list was built; the next request builds it again.
  | { status: "list-changed" }
  | { status: "not-found" };
