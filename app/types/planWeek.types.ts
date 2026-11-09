import type { MealPlanSlot } from "./mealPlan.types";

// The tint of a batch's days in the week view (E6): the brand green, or amber for every other batch of a meal.
export type BatchTone = "primary" | "secondary";

export interface BatchJoins {
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface PlanWeekDay {
  // "YYYY-MM-DD"; slot day_index n is the nth day.
  date: string;
  dayIndex: number;
  isToday: boolean;
  isWorkday: boolean;
  // The first day of a batch: "Cook tonight".
  isCookingDay: boolean;
  // "Monday", "Mon", "9 Nov" and "9", in the viewer's language.
  weekday: string;
  shortWeekday: string;
  day: string;
  dayOfMonth: string;
  // The day's slots the plan shows, in meal order.
  slots: MealPlanSlot[];
}

// One cell of the week grid: a day's slot for one meal, and how it joins its batch's other days in the same row.
export interface PlanWeekCell {
  day: PlanWeekDay;
  slot: MealPlanSlot | null;
  tone: BatchTone | null;
  isJoinedToPrevious: boolean;
  isJoinedToNext: boolean;
}
