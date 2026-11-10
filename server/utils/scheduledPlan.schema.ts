/*
 * Rows the scheduled plan job (H2) reads, as Supabase returns them.
 */
import { z } from "zod";
import { PLAN_DAY_COUNT_MAX, PLAN_DAY_COUNT_MIN, PLAN_KINDS, WEEKDAYS } from "../../shared/utils/mealPlan";
import type { StoredPlanSchedule } from "./scheduledPlanStore.types";

export const SCHEDULE_COLUMNS = "id, kind, user_id, household_id, create_weekday, start_weekday, day_count, time_zone";

const weekdaySchema = z.number().int().refine((weekday) => (WEEKDAYS as readonly number[]).includes(weekday));

export const scheduleRowSchema = z
  .object({
    id: z.guid(),
    kind: z.enum(PLAN_KINDS),
    user_id: z.guid().nullable(),
    household_id: z.guid().nullable(),
    create_weekday: weekdaySchema,
    start_weekday: weekdaySchema,
    day_count: z.number().int().min(PLAN_DAY_COUNT_MIN).max(PLAN_DAY_COUNT_MAX),
    time_zone: z.string().min(1),
  })
  .transform(
    (row): StoredPlanSchedule => ({
      id: row.id,
      kind: row.kind,
      userId: row.user_id,
      householdId: row.household_id,
      createWeekday: row.create_weekday,
      startWeekday: row.start_weekday,
      dayCount: row.day_count,
      timeZone: row.time_zone,
    }),
  );

// create_scheduled_meal_plan() returns its one row as a set.
export const createdPlanRowsSchema = z
  .tuple([z.object({ meal_plan_id: z.guid(), is_created: z.boolean() })])
  .transform(([row]) => row);
