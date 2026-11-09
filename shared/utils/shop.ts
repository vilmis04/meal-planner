/*
 * Shops (G7): where a bought line was bought. A shop is found by its name whatever the case and spacing, as
 * find_or_add_shop() (supabase/migrations/20261117000000_create_shops_and_purchases.sql) finds it: the name is tidied
 * like a line's name and compared in lower case ("  LIDL " finds "Lidl").
 */
import { normaliseItemName } from "./shoppingItemEdit";
import type { Shop } from "./shop.types";

// shops_name_length.
export const SHOP_NAME_MAX_LENGTH = 60;

// The shop's name key, as the shops.name_key column holds it.
export function getShopNameKey(name: string): string {
  return normaliseItemName(name).toLowerCase();
}

// The known shop with this name, if any.
export function findShopByName(shops: readonly Shop[], name: string): Shop | null {
  const nameKey = getShopNameKey(name);
  return shops.find((shop) => getShopNameKey(shop.name) === nameKey) ?? null;
}

// The shops to pick from: one per name (a person who joined a household may still read their own earlier shops), in
// alphabetical order for the locale.
export function getShopChoices(shops: readonly Shop[], locale: string): Shop[] {
  const byNameKey = new Map<string, Shop>();
  for (const shop of shops) {
    const nameKey = getShopNameKey(shop.name);
    if (!byNameKey.has(nameKey)) {
      byNameKey.set(nameKey, shop);
    }
  }
  return [...byNameKey.values()].sort((first, second) => first.name.localeCompare(second.name, locale));
}
