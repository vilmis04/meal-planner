import type { PlanKind } from "../../shared/utils/mealPlan";

// An enabled schedule (H1) as the job reads it. Weekdays are ISO, Monday = 1.
export interface StoredPlanSchedule {
  id: string;
  kind: PlanKind;
  // The individual schedule's owner; null for a household schedule.
  userId: string | null;
  // The household schedule's household; null for an individual schedule.
  householdId: string | null;
  createWeekday: number;
  startWeekday: number;
  dayCount: number;
  // IANA name, checked against pg_timezone_names when it was saved.
  timeZone: string;
}

export type ScheduledPlanCreation =
  | { status: "created"; planId: string }
  // The schedule made this period's plan on an earlier run; it is left as it is.
  | { status: "existing"; planId: string }
  // Turned off after the job read it.
  | { status: "disabled" };

// Where the job reads schedules and makes their plans. The service depends on this interface only, so it is tested
// with an in-memory store. Everything runs as the service role.
export interface PlanScheduleStore {
  loadEnabledSchedules(): Promise<StoredPlanSchedule[]>;
  createPlan(scheduleId: string, startDate: string): Promise<ScheduledPlanCreation>;
}
