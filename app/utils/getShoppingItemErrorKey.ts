export const SHOPPING_ITEM_SAVE_FAILED_KEY = "shoppingList.errors.saveFailed";

// Messages raised by the list functions (supabase/migrations/20261115000000_add_shopping_item_edits.sql) and the shop
// functions (20261117000000_create_shops_and_purchases.sql).
export const SHOPPING_ITEM_ERROR_KEY_BY_MESSAGE: Readonly<Record<string, string>> = {
  item_not_found: "shoppingList.errors.itemNotFound",
  list_not_found: "shoppingList.notFound",
  invalid_name: "shoppingList.errors.invalidName",
  invalid_amount: "shoppingList.errors.invalidAmount",
  invalid_unit: "shoppingList.errors.invalidUnit",
  amount_not_editable: "shoppingList.errors.amountNotEditable",
  too_many_items: "shoppingList.errors.tooManyItems",
  item_not_bought: "shoppingList.errors.itemNotBought",
  invalid_shop_name: "shoppingList.errors.invalidShopName",
  too_many_shops: "shoppingList.errors.tooManyShops",
};

export function getShoppingItemErrorKey({ message }: { message: string }): string {
  return SHOPPING_ITEM_ERROR_KEY_BY_MESSAGE[message] ?? SHOPPING_ITEM_SAVE_FAILED_KEY;
}
