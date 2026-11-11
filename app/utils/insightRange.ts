import type { InsightRange } from "~/types/insightRange.types";

// The ranges the insights pages offer (I1, I2), as ?range= in their address, and how many days back each looks (null:
// everything recorded). get_shop_insights() and get_preference_insights() refuse a range of more than 3660 days.
export const INSIGHT_RANGES = ["last_30_days", "last_90_days", "last_year", "all_time"] as const;
export const DEFAULT_INSIGHT_RANGE: InsightRange = "last_90_days";
export const INSIGHT_RANGE_DAYS: Readonly<Record<InsightRange, number | null>> = {
  last_30_days: 30,
  last_90_days: 90,
  last_year: 365,
  all_time: null,
};

// The range in the address, or the default one for anything else.
export function parseInsightRange(query: unknown): InsightRange {
  return INSIGHT_RANGES.find((range) => range === query) ?? DEFAULT_INSIGHT_RANGE;
}
