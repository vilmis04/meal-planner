import type { ShoppingItem } from "#shared/utils/shoppingList.types";
import type {
  RemoteShoppingItemChange,
  RemoteShoppingListChange,
  ShoppingItemGuardedField,
  ShoppingItemPatch,
} from "~/types/shoppingList.types";

type GetGuardedFields = (itemId: string) => ReadonlySet<ShoppingItemGuardedField>;

// The lines after a change from another copy of the list (G6): the line as it now is, except the fields this viewer has
// on the way, which keep the viewer's value. A line this viewer is adding or deleting ("isPresent") stays as the
// viewer has it.
export function applyRemoteShoppingItemChange(
  items: readonly ShoppingItem[],
  change: RemoteShoppingItemChange,
  getGuardedFields: GetGuardedFields,
): ShoppingItem[] {
  const itemId = change.kind === "upsert" ? change.item.id : change.itemId;
  const guardedFields = getGuardedFields(itemId);
  const local = items.find((item) => item.id === itemId);

  if (change.kind === "delete") {
    return guardedFields.has("isPresent") ? [...items] : items.filter((item) => item.id !== itemId);
  }
  if (local === undefined) {
    return guardedFields.has("isPresent") ? [...items] : [...items, change.item];
  }
  const merged = mergeLine(local, change.item, guardedFields);
  return items.map((item) => (item.id === itemId ? merged : item));
}

// The lines as just read from the database, with what this viewer has on the way kept: guarded fields keep the
// viewer's value, and a line the viewer is adding (or deleting) stays (or stays away) although the read did not see it.
export function mergeStoredShoppingItems(
  items: readonly ShoppingItem[],
  stored: readonly ShoppingItem[],
  getGuardedFields: GetGuardedFields,
): ShoppingItem[] {
  const localById = new Map(items.map((item) => [item.id, item]));
  const storedIds = new Set(stored.map((item) => item.id));
  const merged = stored.flatMap((storedItem) => {
    const guardedFields = getGuardedFields(storedItem.id);
    const local = localById.get(storedItem.id);
    if (local === undefined) {
      return guardedFields.has("isPresent") ? [] : [storedItem];
    }
    return [mergeLine(local, storedItem, guardedFields)];
  });
  const kept = items.filter((item) => !storedIds.has(item.id) && getGuardedFields(item.id).has("isPresent"));
  return [...merged, ...kept];
}

// Whether a change to the list row means the page should read the list again: the plan changed and the list is behind
// it (someone changed the plan), or a rebuild changed what the notes say.
export function isShoppingListCatchUpNeeded(change: RemoteShoppingListChange, shownMissingSwapCount: number): boolean {
  return change.generatedVersion < change.sourceVersion || change.missingSwapCount !== shownMissingSwapCount;
}

const mergeLine = (
  local: ShoppingItem,
  remote: ShoppingItem,
  guardedFields: ReadonlySet<ShoppingItemGuardedField>,
): ShoppingItem => {
  const kept: ShoppingItemPatch = {
    ...(guardedFields.has("state") ? { state: local.state } : {}),
    ...(guardedFields.has("isRemoved") ? { isRemoved: local.isRemoved } : {}),
    ...(guardedFields.has("amountOverride") ? { amountOverride: local.amountOverride } : {}),
    ...(guardedFields.has("amount") ? { amount: local.amount } : {}),
    ...(guardedFields.has("unit") ? { unit: local.unit } : {}),
  };
  return { ...remote, ...kept };
};
