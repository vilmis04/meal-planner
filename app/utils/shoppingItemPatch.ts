import type { ShoppingItem } from "#shared/utils/shoppingList.types";
import type { ShoppingItemPatch } from "~/types/shoppingList.types";

// The lines with one line's fields changed; the same array when there is no such line.
export function patchShoppingItem(
  items: readonly ShoppingItem[],
  itemId: string,
  patch: ShoppingItemPatch,
): ShoppingItem[] {
  return items.map((item) => (item.id === itemId ? { ...item, ...patch } : item));
}

// What the patched fields held before, so a change that is refused can be put back field by field.
export function getPatchedFields(item: ShoppingItem, patch: ShoppingItemPatch): ShoppingItemPatch {
  const fields = Object.keys(patch).filter((field): field is keyof ShoppingItemPatch => field in item);
  return Object.fromEntries(fields.map((field) => [field, item[field]]));
}
