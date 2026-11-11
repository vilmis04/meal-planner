import type { HAVE_AT_HOME_GROUP_KEY } from "#shared/utils/shoppingList";
import type { ShoppingItem, ShoppingListGroupKey } from "#shared/utils/shoppingList.types";
import type { NO_SHOP_HINT_GROUP_KEY, SHOP_HINT_KINDS } from "~/utils/shoppingListShopHints";

interface ShoppingList {
  id: string;
  // The stored lines are behind the plan while generatedVersion < sourceVersion (G2); G6 rebuilds an open list then.
  sourceVersion: number;
  generatedVersion: number;
  missingSwapCount: number;
  items: ShoppingItem[];
}

export type ShoppingListLoadResult = { status: "found"; list: ShoppingList } | { status: "not-found" } | { status: "failed" };

// List id → group key → whether this viewer opened (true) or closed (false) the group, as saved on this device (G3).
export type StoredGroupExpansion = Record<string, Record<string, boolean>>;

// The fields of a line people change (G4), and its purchase (G7), as the page applies them before the database
// confirms.
export type ShoppingItemPatch = Partial<
  Pick<ShoppingItem, "state" | "isRemoved" | "amountOverride" | "amount" | "unit" | "shopId" | "boughtAmount" | "boughtUnit">
>;

// A line's purchase (G7), kept in purchases and read with the line; all null while the line is not bought.
export type ShoppingItemPurchaseFields = Pick<ShoppingItem, "shopId" | "boughtAmount" | "boughtUnit">;

// A line as a change to shopping_items reports it: without its purchase, which changes in purchases (G7).
export type RemoteShoppingItem = Omit<ShoppingItem, keyof ShoppingItemPurchaseFields>;

// What a change to a list resolves to; errorKey is the message to show when nothing was saved.
export type ShoppingItemEditResult = { isSaved: true } | { isSaved: false; errorKey: string };

// A field this viewer is changing (G6): while its change is on the way, and until the database's echo of it arrives,
// the viewer's own value wins over what other copies of the list send. "isPresent" stands for a line this viewer is
// adding or deleting.
export type ShoppingItemGuardedField = keyof ShoppingItemPatch | "isPresent";

// A change to a line made anywhere (another member, another tab, or this viewer's own echo), as Realtime reports it:
// the line itself, or its purchase (G7). A deleted line comes as its id only, and so does a deleted purchase (its key
// is the line's id).
export type RemoteShoppingItemChange =
  | { kind: "upsert"; listId: string; item: RemoteShoppingItem }
  | { kind: "delete"; itemId: string }
  | { kind: "purchase_upsert"; listId: string; itemId: string; purchase: ShoppingItemPurchaseFields }
  | { kind: "purchase_delete"; itemId: string };

// The list row as Realtime reports it after the plan changed or the list was rebuilt.
export interface RemoteShoppingListChange {
  listId: string;
  sourceVersion: number;
  generatedVersion: number;
  missingSwapCount: number;
}

// Whether the page hears other members' changes: not yet, yes, or not at the moment (it reconnects by itself).
export type ShoppingListLiveStatus = "connecting" | "live" | "reconnecting";

export interface ShoppingListLiveHandlers {
  onItemChange: (change: RemoteShoppingItemChange) => void;
  onListChange: (change: RemoteShoppingListChange) => void;
  // Changes may have been missed (just subscribed, reconnected, back to the tab, or a change could not be read).
  onCatchUp: () => void;
}

// Where a line's item is usually bought, or was last bought (I1a), as get_shopping_list_shop_hints() works it out from
// the viewer's purchases on other lists.
export type ShoppingItemShopHintKind = (typeof SHOP_HINT_KINDS)[number];

export interface ShoppingItemShopHint {
  kind: ShoppingItemShopHintKind;
  shopId: string;
  shopName: string;
}

// A group of the list when it is grouped by recommended shop (I1a): one per shop the hints name, the lines without a
// hint, and what is at home.
export type ShoppingListShopGroupKey = `shop:${string}` | typeof NO_SHOP_HINT_GROUP_KEY | typeof HAVE_AT_HOME_GROUP_KEY;

export interface ShoppingListShopGroup {
  key: ShoppingListShopGroupKey;
  // The shop's name; null for the lines without a hint and those at home.
  shopName: string | null;
  items: ShoppingItem[];
  itemCount: number;
  boughtCount: number;
}

// A group the list page shows: a category's (G3) or a recommended shop's (I1a).
export type ShoppingListPageGroupKey = ShoppingListGroupKey | ShoppingListShopGroupKey;
