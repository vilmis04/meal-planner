import { z } from "zod";
import type { ShopInsightRange, ShopInsights, ShopInsightsView } from "~/types/shopInsights.types";

// The ranges the shop insights page offers (I1), as ?range= in its address, and how many days back each looks (null:
// every recorded purchase). get_shop_insights() refuses a range of more than 3660 days.
export const SHOP_INSIGHT_RANGES = ["last_30_days", "last_90_days", "last_year", "all_time"] as const;
export const DEFAULT_SHOP_INSIGHT_RANGE: ShopInsightRange = "last_90_days";
export const SHOP_INSIGHT_RANGE_DAYS: Readonly<Record<ShopInsightRange, number | null>> = {
  last_30_days: 30,
  last_90_days: 90,
  last_year: 365,
  all_time: null,
};

// The items get_shop_insights() returns for each shop (top_item_count in supabase/migrations/20261121000000_add_shop_insights.sql).
const SHOP_INSIGHT_TOP_ITEM_COUNT = 5;

// The range in the address, or the default one for anything else.
export function parseShopInsightRange(query: unknown): ShopInsightRange {
  return SHOP_INSIGHT_RANGES.find((range) => range === query) ?? DEFAULT_SHOP_INSIGHT_RANGE;
}

const countSchema = z.number().int().min(0);

// What get_shop_insights() returns (supabase/migrations/20261121000000_add_shop_insights.sql): the shops, most used
// first, each with its most common items, and how many purchases had no shop the viewer can see.
export const shopInsightsSchema = z
  .object({
    shops: z.array(
      z.object({
        id: z.guid(),
        name: z.string(),
        purchase_count: countSchema.min(1),
        item_count: countSchema.min(1),
        top_items: z
          .array(z.object({ name: z.string(), purchase_count: countSchema.min(1) }))
          .min(1)
          .max(SHOP_INSIGHT_TOP_ITEM_COUNT),
      }),
    ),
    without_shop_count: countSchema,
  })
  .transform(
    (row): ShopInsights => ({
      shops: row.shops.map((shop) => ({
        id: shop.id,
        name: shop.name,
        purchaseCount: shop.purchase_count,
        itemCount: shop.item_count,
        topItems: shop.top_items.map((item) => ({ name: item.name, purchaseCount: item.purchase_count })),
      })),
      withoutShopCount: row.without_shop_count,
    }),
  );

// The page's figures: how many lines were bought at a shop in all, and each shop's share of them in whole percent
// (rounded, so the shares may not add up to exactly 100).
export function getShopInsightsView(insights: ShopInsights): ShopInsightsView {
  const purchaseCount = insights.shops.reduce((sum, shop) => sum + shop.purchaseCount, 0);
  return {
    purchaseCount,
    withoutShopCount: insights.withoutShopCount,
    shops: insights.shops.map((shop) => ({
      ...shop,
      sharePercent: purchaseCount === 0 ? 0 : Math.round((shop.purchaseCount / purchaseCount) * 100),
    })),
  };
}
