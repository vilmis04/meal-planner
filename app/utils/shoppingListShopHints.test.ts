import { describe, expect, it } from "vitest";
import en from "../../i18n/locales/en.json";
import lt from "../../i18n/locales/lt.json";
import { HAVE_AT_HOME_GROUP_KEY, getShoppingListView } from "#shared/utils/shoppingList";
import type { ShoppingItem } from "#shared/utils/shoppingList.types";
import { NO_SHOP_HINT_GROUP_KEY, SHOP_HINT_KINDS, getShoppingListShopGroups, shopHintsSchema } from "./shoppingListShopHints";
import type { ShoppingItemShopHint } from "~/types/shoppingList.types";

const LIDL_ID = "00000000-0000-4000-8000-00000000c001";
const MAXIMA_ID = "00000000-0000-4000-8000-00000000c002";
const ONION_ID = "00000000-0000-4000-8000-0000000000a1";
const MILK_ID = "00000000-0000-4000-8000-0000000000a2";

const item = (id: string, overrides: Partial<ShoppingItem> = {}): ShoppingItem => ({
  id,
  source: "generated",
  ingredientId: null,
  name: id,
  category: "other",
  amount: 100,
  unit: "g",
  isExtra: false,
  swappedFor: [],
  inPlan: true,
  state: "to_buy",
  isRemoved: false,
  amountOverride: null,
  addedBy: null,
  shopId: null,
  boughtAmount: null,
  boughtUnit: null,
  ...overrides,
});

const lidl = (kind: ShoppingItemShopHint["kind"] = "usually"): ShoppingItemShopHint => ({
  kind,
  shopId: LIDL_ID,
  shopName: "Lidl",
});
const maxima: ShoppingItemShopHint = { kind: "last", shopId: MAXIMA_ID, shopName: "Maxima" };

const groupsOf = (
  items: ShoppingItem[],
  hints: Record<string, ShoppingItemShopHint>,
  { isBoughtLast = true, firstShopName = null }: { isBoughtLast?: boolean; firstShopName?: string | null } = {},
) =>
  getShoppingListShopGroups(getShoppingListView(items, { isBoughtLast }), new Map(Object.entries(hints)), {
    isBoughtLast,
    firstShopName,
  }).map((group) => ({ key: group.key, shopName: group.shopName, items: group.items.map((line) => line.id) }));

describe("shopHintsSchema", () => {
  it("reads the hints as line id → hint", () => {
    const hints = shopHintsSchema.parse([
      { item_id: ONION_ID, kind: "usually", shop_id: LIDL_ID, shop_name: "Lidl" },
      { item_id: MILK_ID, kind: "last", shop_id: MAXIMA_ID, shop_name: "Maxima" },
    ]);
    expect(hints.get(ONION_ID)).toEqual(lidl());
    expect(hints.get(MILK_ID)).toEqual(maxima);
    expect(hints.size).toBe(2);
  });

  it("reads no hints", () => {
    expect(shopHintsSchema.parse([]).size).toBe(0);
  });

  it.each([
    null,
    {},
    [{ item_id: ONION_ID, kind: "often", shop_id: LIDL_ID, shop_name: "Lidl" }],
    [{ item_id: "onion", kind: "usually", shop_id: LIDL_ID, shop_name: "Lidl" }],
    [{ item_id: ONION_ID, kind: "usually", shop_id: null, shop_name: "Lidl" }],
    [{ item_id: ONION_ID, kind: "usually", shop_id: LIDL_ID, shop_name: "" }],
  ])("refuses %j", (value) => {
    expect(shopHintsSchema.safeParse(value).success).toBe(false);
  });
});

describe("getShoppingListShopGroups", () => {
  it("groups lines by their hint's shop, most lines first, then the lines without a hint", () => {
    const items = [
      item("Apples", { category: "fruit_and_vegetables" }),
      item("Milk", { category: "dairy_and_eggs" }),
      item("Onion", { category: "fruit_and_vegetables" }),
      item("Salt", { category: "pantry" }),
      item("Cheese", { category: "dairy_and_eggs" }),
    ];
    expect(groupsOf(items, { Apples: maxima, Milk: lidl(), Onion: lidl("last"), Cheese: lidl() })).toEqual([
      // Within a shop, the category view's walk through a shop: fruit and vegetables before dairy.
      { key: `shop:${LIDL_ID}`, shopName: "Lidl", items: ["Onion", "Cheese", "Milk"] },
      { key: `shop:${MAXIMA_ID}`, shopName: "Maxima", items: ["Apples"] },
      { key: NO_SHOP_HINT_GROUP_KEY, shopName: null, items: ["Salt"] },
    ]);
  });

  it("puts the shop being shopped at first, whatever the case", () => {
    const items = [item("Apples"), item("Milk"), item("Onion")];
    const groups = groupsOf(items, { Apples: maxima, Milk: lidl(), Onion: lidl() }, { firstShopName: "MAXIMA" });
    expect(groups.map((group) => group.shopName)).toEqual(["Maxima", "Lidl"]);
  });

  it("orders shops with as many lines by name", () => {
    const groups = groupsOf([item("Apples"), item("Milk")], { Apples: maxima, Milk: lidl() });
    expect(groups.map((group) => group.shopName)).toEqual(["Lidl", "Maxima"]);
  });

  it("keeps a ticked line in its shop's group, last while bought lines go last", () => {
    const items = [item("Apples", { state: "bought" }), item("Milk")];
    const hints = { Apples: lidl(), Milk: lidl() };
    expect(groupsOf(items, hints)).toEqual([{ key: `shop:${LIDL_ID}`, shopName: "Lidl", items: ["Milk", "Apples"] }]);
    expect(groupsOf(items, hints, { isBoughtLast: false })).toEqual([
      { key: `shop:${LIDL_ID}`, shopName: "Lidl", items: ["Apples", "Milk"] },
    ]);
  });

  it("counts each group's lines and bought lines", () => {
    const items = [item("Apples", { state: "bought" }), item("Milk"), item("Salt", { state: "bought" })];
    const view = getShoppingListView(items);
    const groups = getShoppingListShopGroups(view, new Map([["Apples", lidl()], ["Milk", lidl()]]), {
      isBoughtLast: true,
      firstShopName: null,
    });
    expect(groups.map((group) => [group.key, group.boughtCount, group.itemCount])).toEqual([
      [`shop:${LIDL_ID}`, 1, 2],
      [NO_SHOP_HINT_GROUP_KEY, 1, 1],
    ]);
  });

  it("keeps the lines at home last, as in the category view, and leaves out empty groups", () => {
    const items = [item("Milk"), item("Rice", { state: "have_at_home" })];
    expect(groupsOf(items, { Milk: lidl(), Rice: maxima })).toEqual([
      { key: `shop:${LIDL_ID}`, shopName: "Lidl", items: ["Milk"] },
      { key: HAVE_AT_HOME_GROUP_KEY, shopName: null, items: ["Rice"] },
    ]);
  });

  it("has no groups for an empty list", () => {
    expect(groupsOf([], {})).toEqual([]);
  });
});

describe("shop hint texts", () => {
  const lookUp = (messages: unknown, key: string): unknown =>
    key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages);

  it.each([
    ...SHOP_HINT_KINDS.map((kind) => `shoppingList.shopHints.${kind}`),
    "shoppingList.shopHints.toggle",
    "shoppingList.shopHints.groupByShop",
    "shoppingList.shopHints.noHintGroup",
    "shoppingList.shopHints.noHintGroupHint",
  ])("has %s in both languages", (key) => {
    expect(typeof lookUp(en, key)).toBe("string");
    expect(typeof lookUp(lt, key)).toBe("string");
  });

  it.each(SHOP_HINT_KINDS)("names the shop in the %s hint", (kind) => {
    expect(lookUp(en, `shoppingList.shopHints.${kind}`)).toContain("{shop}");
    expect(lookUp(lt, `shoppingList.shopHints.${kind}`)).toContain("{shop}");
  });
});
