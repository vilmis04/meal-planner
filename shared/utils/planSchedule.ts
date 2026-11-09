/*
 * Automatic plan creation (H1): the schedule's defaults and when it runs. The settings screen previews the next run
 * with getScheduleRun(); the scheduled job (H2) calls it with the date on the schedule's own time zone
 * (getDateInTimeZone()) and makes the plan when the run date is that day. The rules are written out in
 * supabase/migrations/20261118000000_create_plan_schedules.sql, whose defaults these match.
 */

import { PLAN_DAY_COUNT_DEFAULT, addDays, getIsoWeekday, getPlanEndDate } from "./mealPlan";
import type { PlanScheduleSettings, ScheduleRun } from "./planSchedule.types";

// As in the design: made on Saturday for the week from the following Monday.
export const DEFAULT_PLAN_SCHEDULE: Readonly<PlanScheduleSettings> = {
  isEnabled: false,
  createWeekday: 6,
  startWeekday: 1,
  dayCount: PLAN_DAY_COUNT_DEFAULT,
  snacksOnList: true,
  participantIds: null,
};

// The run on `fromDate` or the first one after it, and the plan it makes: from the first start weekday after the run
// day (a week later when it is the same weekday), for the schedule's number of days.
export function getScheduleRun(
  { createWeekday, startWeekday, dayCount }: Pick<PlanScheduleSettings, "createWeekday" | "startWeekday" | "dayCount">,
  fromDate: string,
): ScheduleRun {
  const runDate = addDays(fromDate, getDaysUntilWeekday(getIsoWeekday(fromDate), createWeekday));
  const startDate = addDays(runDate, getDaysUntilWeekday(createWeekday, startWeekday) || 7);
  return { runDate, startDate, endDate: getPlanEndDate(startDate, dayCount) };
}

// The calendar date on a time zone's clock at `instant`, as "YYYY-MM-DD": the scheduled job (H2) asks for each
// schedule's own "today". Throws a RangeError for a zone the runtime does not know.
export function getDateInTimeZone(timeZone: string, instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(instant);
  const getPart = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? "";
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

// What a household schedule stores for the members ticked: null while everyone is (so newcomers join too), otherwise
// the ticked ones in the household's order.
export function getScheduleParticipantIds(
  selectedIds: readonly string[],
  memberIds: readonly string[],
): string[] | null {
  const selected = new Set(selectedIds);
  const chosen = memberIds.filter((memberId) => selected.has(memberId));
  return chosen.length === memberIds.length ? null : chosen;
}

// 0 to 6 days from one weekday to the next given one.
const getDaysUntilWeekday = (fromWeekday: number, toWeekday: number): number => (toWeekday - fromWeekday + 7) % 7;
