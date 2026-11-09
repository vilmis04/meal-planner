/*
 * An individual plan alongside a household plan (E7).
 *
 * A member who does not eat from a household plan (E2 lets anyone untick them) can make their own plan for the same
 * days. Both are ordinary plans: the database does not tie them together or stop them overlapping, and each keeps its
 * own slots, participants and, with Epic G, its own shopping list. These rules decide what the plan pages and the
 * home card say about the two.
 */

import { getDaysBetween, getPlanTimeline } from "./mealPlan";
import { newPlanQuerySchema } from "./planAlongside.schema";
import type { AlongsidePlan, NewPlanPrefill, PlanAlongside, PlanPeriod } from "./planAlongside.types";

// Whether two plans share at least one day. Plain "YYYY-MM-DD" strings compare in date order.
export function doPlansOverlap(
  first: Pick<AlongsidePlan, "startDate" | "endDate">,
  second: Pick<AlongsidePlan, "startDate" | "endDate">,
): boolean {
  return first.startDate <= second.endDate && second.startDate <= first.endDate;
}

// The days of `plan` still ahead on `today`: all of an upcoming plan, the rest of a running one (from today), so an
// own plan made from it covers the same days without starting in the past. Null for a plan that has ended.
export function getRemainingPlanPeriod(
  plan: Pick<AlongsidePlan, "startDate" | "endDate">,
  today: string,
): PlanPeriod | null {
  if (plan.endDate < today) {
    return null;
  }
  const startDate = plan.startDate > today ? plan.startDate : today;
  return { startDate, dayCount: getDaysBetween(startDate, plan.endDate) + 1 };
}

// What the page of `plan` says about the viewer's other plans for the same days. `otherPlans` are the plans the
// viewer can see that share a day with it (an individual plan is only ever its owner's). Nothing for a past plan,
// for a household plan the viewer eats from, or for an individual plan with no household plan beside it.
export function getPlanAlongside(
  plan: AlongsidePlan,
  otherPlans: readonly AlongsidePlan[],
  viewerId: string,
  today: string,
): PlanAlongside | null {
  if (getPlanTimeline(plan.startDate, plan.endDate, today) === "past") {
    return null;
  }

  const overlappingPlans = otherPlans
    .filter((other) => other.id !== plan.id && doPlansOverlap(plan, other))
    .sort((first, second) => first.startDate.localeCompare(second.startDate));

  if (plan.kind === "individual") {
    const householdPlan = overlappingPlans.find((other) => other.kind === "household");
    if (!householdPlan) {
      return null;
    }
    const isViewerParticipant = householdPlan.participantIds.includes(viewerId);
    return { type: "household_plan", plan: householdPlan, isViewerParticipant };
  }

  if (plan.participantIds.includes(viewerId)) {
    return null;
  }
  const ownPlan = overlappingPlans.find(
    (other) => other.kind === "individual" && other.participantIds.includes(viewerId),
  );
  if (ownPlan) {
    return { type: "own_plan", plan: ownPlan };
  }
  const period = getRemainingPlanPeriod(plan, today);
  return period ? { type: "create_own", ...period } : null;
}

// The plan the home card shows of the current and upcoming ones (sorted by start date): one the viewer eats from
// comes before one they do not, so a household plan they left for the week does not hide their own plan; then a
// running plan before a later one. Null when there is none.
export function getFeaturedPlan<Plan extends AlongsidePlan>(
  activePlans: readonly Plan[],
  viewerId: string | null,
  today: string,
): Plan | null {
  const isViewerEating = (plan: Plan): boolean => viewerId !== null && plan.participantIds.includes(viewerId);
  const isCurrent = (plan: Plan): boolean => getPlanTimeline(plan.startDate, plan.endDate, today) === "current";
  const eatingPlans = activePlans.filter(isViewerEating);
  return eatingPlans.find(isCurrent) ?? eatingPlans[0] ?? activePlans.find(isCurrent) ?? activePlans[0] ?? null;
}

// The address query of the New plan screen for the viewer's own plan over `period`.
export function getOwnPlanQuery(period: PlanPeriod): Record<string, string> {
  return { kind: "individual", start: period.startDate, days: String(period.dayCount) };
}

// What the New plan screen's address asks it to fill in; anything it does not say is undefined.
export function parseNewPlanQuery(query: Record<string, unknown>): NewPlanPrefill {
  const { kind, start, days } = newPlanQuerySchema.parse(query);
  return { kind, startDate: start, dayCount: days };
}
