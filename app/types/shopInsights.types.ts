interface ShopInsightItem {
  name: string;
  // How many bought lines of this item were bought at the shop.
  purchaseCount: number;
}

interface ShopInsight {
  id: string;
  name: string;
  // Lines bought at the shop, and how many different items they were.
  purchaseCount: number;
  itemCount: number;
  // The most common items there, most bought first.
  topItems: ShopInsightItem[];
}

// Where the viewer's household bought things over a range (I1), as get_shop_insights() returns it.
export interface ShopInsights {
  shops: ShopInsight[];
  // Purchases without a shop (skipped, or at a shop the viewer cannot see): left out of the shops.
  withoutShopCount: number;
}

export interface ShopInsightsView {
  // Lines bought at one of the shops.
  purchaseCount: number;
  withoutShopCount: number;
  shops: (ShopInsight & { sharePercent: number })[];
}

export type ShopInsightsLoadResult = { status: "loaded"; insights: ShopInsights } | { status: "failed" };
