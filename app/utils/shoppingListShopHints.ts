import { z } from "zod";
import { HAVE_AT_HOME_GROUP_KEY } from "#shared/utils/shoppingList";
import type { ShoppingItem, ShoppingListView } from "#shared/utils/shoppingList.types";
import type {
  ShoppingItemShopHint,
  ShoppingListShopGroup,
  ShoppingListShopGroupKey,
} from "~/types/shoppingList.types";

// The hints get_shopping_list_shop_hints() gives (supabase/migrations/20261122000000_add_shopping_list_shop_hints.sql):
// "usually" when one shop has more than half of the item's recent purchases, else "last", the most recent one's shop.
export const SHOP_HINT_KINDS = ["usually", "last"] as const;
// The group of lines without a hint when the list is grouped by recommended shop, after the shops' groups.
export const NO_SHOP_HINT_GROUP_KEY = "no_shop_hint";

// Shop names are compared as the database's name_key does, and sorted as the recipes are written (Lithuanian).
const NAME_COLLATION_LOCALE = "lt";

// What get_shopping_list_shop_hints() returns, as line id → its hint. A line appears at most once.
export const shopHintsSchema = z
  .array(
    z.object({
      item_id: z.guid(),
      kind: z.enum(SHOP_HINT_KINDS),
      shop_id: z.guid(),
      shop_name: z.string().min(1),
    }),
  )
  .transform(
    (rows): ReadonlyMap<string, ShoppingItemShopHint> =>
      new Map(rows.map((row) => [row.item_id, { kind: row.kind, shopId: row.shop_id, shopName: row.shop_name }])),
  );

// The list grouped by recommended shop (I1a): a group per shop the hints name, the shop being shopped at first, then the
// shops with the most lines (ties by name); then the lines without a hint, then what is at home, as in the category
// view. Lines keep the category view's walk through a shop; while isBoughtLast is on, bought lines go last in their
// group. A line stays in its group when it is ticked, as its hint comes from other lists.
export function getShoppingListShopGroups(
  view: ShoppingListView,
  hints: ReadonlyMap<string, ShoppingItemShopHint>,
  { isBoughtLast, firstShopName }: { isBoughtLast: boolean; firstShopName: string | null },
): ShoppingListShopGroup[] {
  const atHomeGroup = view.groups.find((group) => group.key === HAVE_AT_HOME_GROUP_KEY);
  const shoppingItems = view.groups.filter((group) => group.key !== HAVE_AT_HOME_GROUP_KEY).flatMap((group) => group.items);
  const orderItems = (groupItems: ShoppingItem[]): ShoppingItem[] =>
    isBoughtLast ? [...groupItems].sort((first, second) => Number(isBought(first)) - Number(isBought(second))) : groupItems;

  const shopLines = new Map<string, ShopLines>();
  const linesWithoutHint: ShoppingItem[] = [];
  for (const item of shoppingItems) {
    const hint = hints.get(item.id);
    if (hint === undefined) {
      linesWithoutHint.push(item);
      continue;
    }
    const shop = shopLines.get(hint.shopId) ?? { shopName: hint.shopName, items: [] };
    shop.items.push(item);
    shopLines.set(hint.shopId, shop);
  }

  const firstShopKey = firstShopName === null ? null : toNameKey(firstShopName);
  const shopGroups = [...shopLines.entries()]
    .sort(([, first], [, second]) => compareShops(first, second, firstShopKey))
    .map(([shopId, shop]) => toGroup(`shop:${shopId}`, shop.shopName, orderItems(shop.items)));
  const groups = [
    ...shopGroups,
    toGroup(NO_SHOP_HINT_GROUP_KEY, null, orderItems(linesWithoutHint)),
    toGroup(HAVE_AT_HOME_GROUP_KEY, null, atHomeGroup?.items ?? []),
  ];
  return groups.filter((group) => group.itemCount > 0);
}

// The lines whose hint names one shop.
interface ShopLines {
  shopName: string;
  items: ShoppingItem[];
}

const isBought = (item: ShoppingItem): boolean => item.state === "bought";

const toNameKey = (name: string): string => name.toLowerCase();

const compareShops = (
  first: ShopLines,
  second: ShopLines,
  firstShopKey: string | null,
): number =>
  Number(toNameKey(second.shopName) === firstShopKey) - Number(toNameKey(first.shopName) === firstShopKey) ||
  second.items.length - first.items.length ||
  first.shopName.localeCompare(second.shopName, NAME_COLLATION_LOCALE);

const toGroup = (key: ShoppingListShopGroupKey, shopName: string | null, items: ShoppingItem[]): ShoppingListShopGroup => ({
  key,
  shopName,
  items,
  itemCount: items.length,
  boughtCount: items.filter(isBought).length,
});
