import type { ShopInsightRange, ShopInsightsLoadResult } from "~/types/shopInsights.types";

// Where the viewer's household buys things (I1). get_shop_insights() runs as the viewer, so row level security decides
// which purchases it sums up: those of the plans the viewer can open, as on the shopping list.
export function useShopInsights() {
  const supabase = useSupabaseClient();

  const load = async (range: ShopInsightRange): Promise<ShopInsightsLoadResult> => {
    const { data, error } = await supabase.rpc("get_shop_insights", { range_days: SHOP_INSIGHT_RANGE_DAYS[range] });
    const result = error ? null : shopInsightsSchema.safeParse(data);
    if (!result?.success) {
      console.error("Loading the shop insights failed", error ?? result?.error);
      return { status: "failed" };
    }
    return { status: "loaded", insights: result.data };
  };

  return { load };
}
