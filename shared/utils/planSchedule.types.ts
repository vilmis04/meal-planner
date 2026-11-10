// What a schedule (H1) decides about the plans it makes. Weekdays are ISO, Monday = 1 to Sunday = 7.
export interface PlanScheduleSettings {
  isEnabled: boolean;
  // The weekday the next plan is made on.
  createWeekday: number;
  // The plan starts on the first such weekday after the run day.
  startWeekday: number;
  dayCount: number;
  snacksOnList: boolean;
  // Null: everyone in the household when the plan is made. Always null for an individual schedule.
  participantIds: string[] | null;
}

// One run of a schedule: the day the plan is made and the days it covers, as "YYYY-MM-DD".
export interface ScheduleRun {
  runDate: string;
  startDate: string;
  endDate: string;
}
