/*
 * Rows and requests of plan adjustments (I3), parsed with zod. Kept here because every file under server/api is a
 * route.
 */
import { z } from "zod";
import { PLAN_DAY_COUNT_MAX, PLAN_DAY_COUNT_MIN, isIsoDate } from "../../shared/utils/mealPlan";
import { PLAN_ADJUSTMENT_TEXT_MAX_LENGTH, normalizeAdjustmentText } from "../../shared/utils/planAdjustment";
import type { AdjustablePlan } from "./planAdjustmentStore.types";

export const adjustablePlanRowSchema = z
  .object({
    id: z.guid(),
    start_date: z.string().refine(isIsoDate),
    day_count: z.number().int().min(PLAN_DAY_COUNT_MIN).max(PLAN_DAY_COUNT_MAX),
    include_snacks: z.boolean(),
  })
  .transform(
    (row): AdjustablePlan => ({
      id: row.id,
      startDate: row.start_date,
      dayCount: row.day_count,
      includeSnacks: row.include_snacks,
    }),
  );

export const adjustmentIngredientRowSchema = z.object({ id: z.guid(), name: z.string().min(1) });

// POST /api/plans/:id/adjustment
export const adjustmentRouteParamsSchema = z.object({ id: z.guid() });

// The request text, normalized; too long or empty text never reaches the AI.
export const adjustmentRequestBodySchema = z.object({
  text: z
    .string()
    .max(PLAN_ADJUSTMENT_TEXT_MAX_LENGTH)
    .transform(normalizeAdjustmentText)
    .pipe(z.string().min(1)),
});
