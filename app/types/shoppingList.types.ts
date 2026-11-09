import type { ShoppingItem } from "#shared/utils/shoppingList.types";

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

// The fields of a line people change (G4), as the page applies them before the database confirms.
export type ShoppingItemPatch = Partial<Pick<ShoppingItem, "state" | "isRemoved" | "amountOverride" | "amount" | "unit">>;

// What a change to a list resolves to; errorKey is the message to show when nothing was saved.
export type ShoppingItemEditResult = { isSaved: true } | { isSaved: false; errorKey: string };

// A field this viewer is changing (G6): while its change is on the way, and until the database's echo of it arrives,
// the viewer's own value wins over what other copies of the list send. "isPresent" stands for a line this viewer is
// adding or deleting.
export type ShoppingItemGuardedField = keyof ShoppingItemPatch | "isPresent";

// A change to a line made anywhere (another member, another tab, or this viewer's own echo), as Realtime reports it.
// A deleted line comes as its id only.
export type RemoteShoppingItemChange =
  | { kind: "upsert"; listId: string; item: ShoppingItem }
  | { kind: "delete"; itemId: string };

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
