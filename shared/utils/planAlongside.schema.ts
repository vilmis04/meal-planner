import { z } from "zod";
import { PLAN_DAY_COUNT_MAX, PLAN_DAY_COUNT_MIN, PLAN_KINDS, isIsoDate } from "./mealPlan";

// The New plan screen's address can say what to fill in: /plans/new?kind=individual&start=2026-11-16&days=7 (E7). A
// value that is missing or not allowed is ignored, so a hand-edited address still opens the screen with its defaults.
export const newPlanQuerySchema = z.object({
  kind: z.enum(PLAN_KINDS).optional().catch(undefined),
  start: z.string().refine(isIsoDate).optional().catch(undefined),
  days: z.coerce.number().int().min(PLAN_DAY_COUNT_MIN).max(PLAN_DAY_COUNT_MAX).optional().catch(undefined),
});
