import type { INSIGHT_RANGES } from "~/utils/insightRange";

// A range an insights page (I1, I2) sums up over.
export type InsightRange = (typeof INSIGHT_RANGES)[number];
