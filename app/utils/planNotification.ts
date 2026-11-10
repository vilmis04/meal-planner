import { z } from "zod";
import { PLAN_KINDS, isIsoDate } from "#shared/utils/mealPlan";

// The viewer's unread notices of plans the scheduled job made (H3), with the plan's days. The inner join leaves out
// notices of plans the viewer can no longer read; the plan's end date filters out plans that are over.
export const PLAN_NOTIFICATION_COLUMNS = "id, meal_plans!inner(id, kind, start_date, end_date)";

// A person has at most one schedule of each kind, so more than a few unread notices means old ones nobody opened.
export const PLAN_NOTIFICATION_LIMIT = 3;

const isoDateSchema = z.string().refine(isIsoDate);

const planNotificationRowSchema = z.object({
  id: z.guid(),
  meal_plans: z.object({
    id: z.guid(),
    kind: z.enum(PLAN_KINDS),
    start_date: isoDateSchema,
    end_date: isoDateSchema,
  }),
});

export const planNotificationRowsSchema = z.array(planNotificationRowSchema).transform((rows) =>
  rows.map((row) => ({
    id: row.id,
    planId: row.meal_plans.id,
    planKind: row.meal_plans.kind,
    startDate: row.meal_plans.start_date,
    endDate: row.meal_plans.end_date,
  })),
);
