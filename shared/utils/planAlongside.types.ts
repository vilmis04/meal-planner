import type { PlanKind } from "./mealPlan";

// What the rules about plans side by side (E7) need of a plan: its kind, its days and who eats from it.
export interface AlongsidePlan {
  id: string;
  kind: PlanKind;
  startDate: string;
  endDate: string;
  participantIds: readonly string[];
}

// The days an individual plan made from another plan covers: a start date and a day count, as the New plan screen
// takes them.
export interface PlanPeriod {
  startDate: string;
  dayCount: number;
}

// What the New plan screen's address asks it to fill in (E7); a field it does not name keeps the screen's default.
export interface NewPlanPrefill {
  kind: PlanKind | undefined;
  startDate: string | undefined;
  dayCount: number | undefined;
}

// What a plan page says about the viewer's other plans for the same days (E7):
//   * create_own: a household plan the viewer does not eat from, with no plan of their own for those days yet;
//   * own_plan: the same, when the viewer already has their own plan for some of those days;
//   * household_plan: the viewer's own plan, with a household plan for some of the same days.
export type PlanAlongside =
  | ({ type: "create_own" } & PlanPeriod)
  | { type: "own_plan"; plan: AlongsidePlan }
  | { type: "household_plan"; plan: AlongsidePlan; isViewerParticipant: boolean };
