import type { InsightRange } from "~/types/insightRange.types";
import type { PreferenceInsightsLoadResult } from "~/types/preferenceInsights.types";

// The viewer's most liked and most skipped meals (I2). get_preference_insights() runs as the viewer: their own ratings,
// and the plans they eat from.
export function usePreferenceInsights() {
  const supabase = useSupabaseClient();

  const load = async (range: InsightRange): Promise<PreferenceInsightsLoadResult> => {
    const { data, error } = await supabase.rpc("get_preference_insights", { range_days: INSIGHT_RANGE_DAYS[range] });
    const result = error ? null : preferenceInsightsSchema.safeParse(data);
    if (!result?.success) {
      console.error("Loading the preference insights failed", error ?? result?.error);
      return { status: "failed" };
    }
    return { status: "loaded", insights: result.data };
  };

  return { load };
}
