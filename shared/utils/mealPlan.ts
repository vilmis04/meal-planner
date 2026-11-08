/*
 * Meal plan rules shared by the New plan screen and the plan page (E1).
 *
 * Dates are plain "YYYY-MM-DD" strings end to end, as Postgres `date` returns them. Day arithmetic is done in
 * UTC on those strings, so a plan never shifts by a day across time zones or daylight saving changes.
 *
 * PLAN_KINDS and the day count limits must match the checks in
 * supabase/migrations/20261106000000_create_meal_plans.sql.
 */

import { MEAL_TYPES } from "./mealFilter";
import type { MealType } from "./mealFilter";

export const PLAN_KINDS = ["household", "individual"] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

export const PLAN_DAY_COUNT_MIN = 1;
export const PLAN_DAY_COUNT_MAX = 14;
export const PLAN_DAY_COUNT_DEFAULT = 7;

// ISO weekdays, Monday = 1 to Sunday = 7, the numbers meal_plans.workdays stores (E4). The meal_plans_workdays_supported
// check (supabase/migrations/20261109000000_add_meal_plan_generation.sql) allows these only.
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const DEFAULT_WORKDAYS: readonly number[] = [1, 2, 3, 4, 5];

// How long a planned recipe rests before the generator offers it again (E4). Must match the
// meal_plans_cooldown_days_range check; the New plan screen offers COOLDOWN_DAYS_OPTIONS.
export const COOLDOWN_DAYS_DEFAULT = 14;
export const COOLDOWN_DAYS_MAX = 60;
export const COOLDOWN_DAYS_OPTIONS: readonly number[] = [0, 7, 14, 21, 28];

// What POST /api/plans/:id/generate fills (E5): only the empty slots, or every slot that is not locked.
export const GENERATION_MODES = ["fill_empty", "regenerate_unlocked"] as const;
export type GenerationMode = (typeof GENERATION_MODES)[number];

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// A real calendar date in "YYYY-MM-DD" form (so not 2026-02-30).
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const match = ISO_DATE.exec(value);
  if (!match) {
    return false;
  }
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

function toUtcTime(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!);
}

function fromUtcTime(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  return fromUtcTime(toUtcTime(isoDate) + days * DAY_MS);
}

// The calendar date the user sees on their own clock, not the UTC date.
export function toLocalIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// The Monday after today, also when today is a Monday: plans are made ahead for the coming week.
export function getDefaultStartDate(today: string): string {
  const weekday = new Date(toUtcTime(today)).getUTCDay();
  const daysUntilMonday = (8 - weekday) % 7 || 7;
  return addDays(today, daysUntilMonday);
}

// A whole number of days within the limits; anything that is not a number gives the default.
export function clampDayCount(value: number): number {
  if (!Number.isFinite(value)) {
    return PLAN_DAY_COUNT_DEFAULT;
  }
  return Math.min(PLAN_DAY_COUNT_MAX, Math.max(PLAN_DAY_COUNT_MIN, Math.round(value)));
}

// The date of every day of the plan, in order. Slot day_index n is the nth of these.
export function getPlanDays(startDate: string, dayCount: number): string[] {
  return Array.from({ length: dayCount }, (_, index) => addDays(startDate, index));
}

// 1 for Monday to 7 for Sunday.
export function getIsoWeekday(isoDate: string): number {
  return new Date(toUtcTime(isoDate)).getUTCDay() || 7;
}

// Whole days from `earlierDate` to `laterDate`; negative when `earlierDate` is the later one.
export function getDaysBetween(earlierDate: string, laterDate: string): number {
  return Math.round((toUtcTime(laterDate) - toUtcTime(earlierDate)) / DAY_MS);
}

// The weekdays sorted, without repeats and without anything that is not a weekday.
export function normalizeWorkdays(workdays: readonly number[]): number[] {
  return WEEKDAYS.filter((weekday) => workdays.includes(weekday));
}

export function getPlanEndDate(startDate: string, dayCount: number): string {
  return addDays(startDate, dayCount - 1);
}

// Where a plan stands on the viewer's calendar (E6): running today, starting later, or over. Plain "YYYY-MM-DD"
// strings compare in date order. meal_plans.end_date is the same last day, for the plan list's queries.
export type PlanTimeline = "current" | "upcoming" | "past";

export function getPlanTimeline(startDate: string, endDate: string, today: string): PlanTimeline {
  if (endDate < today) {
    return "past";
  }
  return startDate > today ? "upcoming" : "current";
}

// How many portions quantities scale to (E2): one per participant. The shopping list (G2) multiplies
// per-person amounts by this; a plan whose last participant left the household scales to 0.
export function getPlanServings(participantIds: readonly string[]): number {
  return new Set(participantIds).size;
}

// The slots a plan shows: skipped snacks are kept in the database but not shown.
export function getVisibleMealTypes(includeSnacks: boolean): MealType[] {
  return MEAL_TYPES.filter((mealType) => includeSnacks || mealType !== "snack");
}
