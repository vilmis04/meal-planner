import { z } from "zod";
import type { PlanKind } from "#shared/utils/mealPlan";
import type { PlanScheduleSettings } from "#shared/utils/planSchedule.types";

// The schedules the viewer can read (H1): their own and their household's (row level security shows only those).
export const PLAN_SCHEDULE_COLUMNS =
  "kind, is_enabled, create_weekday, start_weekday, day_count, snacks_on_list, includes_all_members, plan_schedule_participants(user_id)";

const weekdaySchema = z.number().int().min(1).max(7);

const planScheduleRowSchema = z.object({
  kind: z.enum(PLAN_KINDS),
  is_enabled: z.boolean(),
  create_weekday: weekdaySchema,
  start_weekday: weekdaySchema,
  day_count: z.number().int().min(PLAN_DAY_COUNT_MIN).max(PLAN_DAY_COUNT_MAX),
  snacks_on_list: z.boolean(),
  includes_all_members: z.boolean(),
  plan_schedule_participants: z.array(z.object({ user_id: z.guid() })),
});

// By kind; a kind with no row has no schedule saved yet.
export const planScheduleRowsSchema = z.array(planScheduleRowSchema).transform((rows) => {
  const schedules: Partial<Record<PlanKind, PlanScheduleSettings>> = {};
  for (const row of rows) {
    schedules[row.kind] = {
      isEnabled: row.is_enabled,
      createWeekday: row.create_weekday,
      startWeekday: row.start_weekday,
      dayCount: row.day_count,
      snacksOnList: row.snacks_on_list,
      participantIds: row.includes_all_members
        ? null
        : row.plan_schedule_participants.map((participant) => participant.user_id),
    };
  }
  return schedules;
});
