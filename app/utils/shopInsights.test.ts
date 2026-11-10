import { describe, expect, it } from "vitest";
import en from "../../i18n/locales/en.json";
import lt from "../../i18n/locales/lt.json";
import {
  DEFAULT_SHOP_INSIGHT_RANGE,
  SHOP_INSIGHT_RANGES,
  SHOP_INSIGHT_RANGE_DAYS,
  getShopInsightsView,
  parseShopInsightRange,
  shopInsightsSchema,
} from "./shopInsights";

const lidl = {
  id: "00000000-0000-4000-8000-00000000c001",
  name: "Lidl",
  purchase_count: 3,
  item_count: 2,
  top_items: [
    { name: "Chicken thigh", purchase_count: 2 },
    { name: "Eggs", purchase_count: 1 },
  ],
};
const maxima = {
  id: "00000000-0000-4000-8000-00000000c002",
  name: "Maxima",
  purchase_count: 1,
  item_count: 1,
  top_items: [{ name: "Coffee", purchase_count: 1 }],
};

describe("parseShopInsightRange", () => {
  it.each(SHOP_INSIGHT_RANGES)("reads %s from the address", (range) => {
    expect(parseShopInsightRange(range)).toBe(range);
  });

  it.each([undefined, null, "", "last_7_days", ["all_time"]])("falls back to the default for %j", (query) => {
    expect(parseShopInsightRange(query)).toBe(DEFAULT_SHOP_INSIGHT_RANGE);
  });
});

describe("SHOP_INSIGHT_RANGE_DAYS", () => {
  it("looks back a whole number of days get_shop_insights() accepts, or over everything", () => {
    for (const days of Object.values(SHOP_INSIGHT_RANGE_DAYS)) {
      expect(days === null || (Number.isInteger(days) && days >= 1 && days <= 3660)).toBe(true);
    }
    expect(SHOP_INSIGHT_RANGE_DAYS.all_time).toBeNull();
  });
});

describe("shopInsightsSchema", () => {
  it("reads the shops with their most common items", () => {
    expect(shopInsightsSchema.parse({ shops: [lidl, maxima], without_shop_count: 4 })).toEqual({
      shops: [
        {
          id: lidl.id,
          name: "Lidl",
          purchaseCount: 3,
          itemCount: 2,
          topItems: [
            { name: "Chicken thigh", purchaseCount: 2 },
            { name: "Eggs", purchaseCount: 1 },
          ],
        },
        { id: maxima.id, name: "Maxima", purchaseCount: 1, itemCount: 1, topItems: [{ name: "Coffee", purchaseCount: 1 }] },
      ],
      withoutShopCount: 4,
    });
  });

  it("reads no shops", () => {
    expect(shopInsightsSchema.parse({ shops: [], without_shop_count: 0 })).toEqual({ shops: [], withoutShopCount: 0 });
  });

  it("refuses what the function never returns", () => {
    const parses = (value: unknown): boolean => shopInsightsSchema.safeParse(value).success;
    expect(parses(null)).toBe(false);
    expect(parses({ shops: [lidl] })).toBe(false);
    expect(parses({ shops: [{ ...lidl, id: "lidl" }], without_shop_count: 0 })).toBe(false);
    expect(parses({ shops: [{ ...lidl, purchase_count: 0 }], without_shop_count: 0 })).toBe(false);
    expect(parses({ shops: [{ ...lidl, purchase_count: 1.5 }], without_shop_count: 0 })).toBe(false);
    expect(parses({ shops: [{ ...lidl, top_items: [] }], without_shop_count: 0 })).toBe(false);
    const sixItems = Array.from({ length: 6 }, (_, index) => ({ name: `Item ${index}`, purchase_count: 1 }));
    expect(parses({ shops: [{ ...lidl, top_items: sixItems }], without_shop_count: 0 })).toBe(false);
    expect(parses({ shops: [], without_shop_count: -1 })).toBe(false);
  });
});

describe("getShopInsightsView", () => {
  it("adds up the lines bought at a shop and gives each shop its share in whole percent", () => {
    const insights = shopInsightsSchema.parse({ shops: [lidl, maxima], without_shop_count: 4 });
    const view = getShopInsightsView(insights);
    expect(view.purchaseCount).toBe(4);
    expect(view.withoutShopCount).toBe(4);
    expect(view.shops.map((shop) => [shop.name, shop.sharePercent])).toEqual([
      ["Lidl", 75],
      ["Maxima", 25],
    ]);
  });

  it("rounds shares", () => {
    const insights = shopInsightsSchema.parse({
      shops: [
        { ...lidl, purchase_count: 2 },
        { ...maxima, purchase_count: 1 },
      ],
      without_shop_count: 0,
    });
    expect(getShopInsightsView(insights).shops.map((shop) => shop.sharePercent)).toEqual([67, 33]);
  });

  it("has nothing to share without shops", () => {
    expect(getShopInsightsView({ shops: [], withoutShopCount: 2 })).toEqual({
      purchaseCount: 0,
      withoutShopCount: 2,
      shops: [],
    });
  });
});

describe("shop insights texts", () => {
  const lookUp = (messages: unknown, key: string): unknown =>
    key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages);
  const keysOf = (node: unknown, prefix: string): string[] =>
    typeof node === "object" && node !== null
      ? Object.entries(node).flatMap(([part, child]) => keysOf(child, `${prefix}.${part}`))
      : [prefix];

  it("has the same insights texts in both languages", () => {
    expect(keysOf(lookUp(lt, "insights"), "insights")).toEqual(keysOf(lookUp(en, "insights"), "insights"));
  });

  it.each([
    ...SHOP_INSIGHT_RANGES.map((range) => `insights.range.options.${range}`),
    "profile.shops.title",
    "profile.shops.hint",
  ])("has %s in both languages", (key) => {
    expect(typeof lookUp(en, key)).toBe("string");
    expect(typeof lookUp(lt, key)).toBe("string");
  });
});
