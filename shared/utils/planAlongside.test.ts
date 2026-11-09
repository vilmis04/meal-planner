import { describe, expect, it } from "vitest";
import {
  doPlansOverlap,
  getFeaturedPlan,
  getOwnPlanQuery,
  getPlanAlongside,
  getRemainingPlanPeriod,
  parseNewPlanQuery,
} from "./planAlongside";
import type { AlongsidePlan } from "./planAlongside.types";

const ANA = "00000000-0000-0000-0000-000000000001";
const MONIKA = "00000000-0000-0000-0000-000000000002";
const TODAY = "2026-11-09";

const createPlan = (overrides: Partial<AlongsidePlan> & Pick<AlongsidePlan, "id">): AlongsidePlan => ({
  kind: "household",
  startDate: "2026-11-16",
  endDate: "2026-11-22",
  participantIds: [ANA, MONIKA],
  ...overrides,
});

describe("doPlansOverlap", () => {
  it.each([
    ["the same days", "2026-11-16", "2026-11-22", true],
    ["a day inside", "2026-11-18", "2026-11-18", true],
    ["the last day only", "2026-11-22", "2026-11-28", true],
    ["the first day only", "2026-11-10", "2026-11-16", true],
    ["the week before", "2026-11-09", "2026-11-15", false],
    ["the week after", "2026-11-23", "2026-11-29", false],
  ])("a plan for 16–22 Nov and one on %s", (_, startDate, endDate, isOverlapping) => {
    const plan = { startDate: "2026-11-16", endDate: "2026-11-22" };
    expect(doPlansOverlap(plan, { startDate, endDate })).toBe(isOverlapping);
    expect(doPlansOverlap({ startDate, endDate }, plan)).toBe(isOverlapping);
  });
});

describe("getRemainingPlanPeriod", () => {
  it("covers every day of an upcoming plan", () => {
    expect(getRemainingPlanPeriod({ startDate: "2026-11-16", endDate: "2026-11-29" }, TODAY)).toEqual({
      startDate: "2026-11-16",
      dayCount: 14,
    });
  });

  it("starts a running plan's period today", () => {
    expect(getRemainingPlanPeriod({ startDate: "2026-11-06", endDate: "2026-11-12" }, TODAY)).toEqual({
      startDate: TODAY,
      dayCount: 4,
    });
    expect(getRemainingPlanPeriod({ startDate: "2026-11-03", endDate: TODAY }, TODAY)).toEqual({
      startDate: TODAY,
      dayCount: 1,
    });
  });

  it("has nothing left of a past plan", () => {
    expect(getRemainingPlanPeriod({ startDate: "2026-11-01", endDate: "2026-11-08" }, TODAY)).toBeNull();
  });
});

describe("getPlanAlongside", () => {
  const household = createPlan({ id: "household", participantIds: [ANA] });

  it("offers Monika her own plan for the household plan's days when she does not eat from it", () => {
    expect(getPlanAlongside(household, [], MONIKA, TODAY)).toEqual({
      type: "create_own",
      startDate: "2026-11-16",
      dayCount: 7,
    });
  });

  it("offers the rest of a running household plan", () => {
    const running = createPlan({
      id: "running",
      startDate: "2026-11-07",
      endDate: "2026-11-13",
      participantIds: [ANA],
    });
    expect(getPlanAlongside(running, [], MONIKA, TODAY)).toEqual({ type: "create_own", startDate: TODAY, dayCount: 5 });
  });

  it("says nothing to someone who eats from the household plan", () => {
    expect(getPlanAlongside(household, [], ANA, TODAY)).toBeNull();
  });

  it("says nothing about a past plan", () => {
    const past = createPlan({ id: "past", startDate: "2026-11-01", endDate: "2026-11-07", participantIds: [ANA] });
    expect(getPlanAlongside(past, [], MONIKA, TODAY)).toBeNull();
  });

  it("points Monika to her own plan for some of the same days, the earliest first", () => {
    const later = createPlan({ id: "later", kind: "individual", startDate: "2026-11-20", participantIds: [MONIKA] });
    const earlier = createPlan({
      id: "earlier",
      kind: "individual",
      startDate: "2026-11-14",
      participantIds: [MONIKA],
    });
    expect(getPlanAlongside(household, [later, earlier], MONIKA, TODAY)).toEqual({ type: "own_plan", plan: earlier });
  });

  it("does not count her plan for other days, or another household plan", () => {
    const otherWeek = createPlan({
      id: "other-week",
      kind: "individual",
      startDate: "2026-11-23",
      endDate: "2026-11-29",
      participantIds: [MONIKA],
    });
    const otherHousehold = createPlan({ id: "other-household", participantIds: [ANA] });
    expect(getPlanAlongside(household, [otherWeek, otherHousehold], MONIKA, TODAY)?.type).toBe("create_own");
  });

  it("on her own plan, points to the household plan for the same days and says whether she still eats from it", () => {
    const own = createPlan({ id: "own", kind: "individual", participantIds: [MONIKA] });
    expect(getPlanAlongside(own, [household], MONIKA, TODAY)).toEqual({
      type: "household_plan",
      plan: household,
      isViewerParticipant: false,
    });
    const shared = createPlan({ id: "shared" });
    expect(getPlanAlongside(own, [shared], MONIKA, TODAY)).toEqual({
      type: "household_plan",
      plan: shared,
      isViewerParticipant: true,
    });
  });

  it("says nothing on an individual plan with no household plan beside it", () => {
    const own = createPlan({ id: "own", kind: "individual", participantIds: [MONIKA] });
    const otherOwn = createPlan({ id: "other-own", kind: "individual", participantIds: [MONIKA] });
    expect(getPlanAlongside(own, [own, otherOwn], MONIKA, TODAY)).toBeNull();
  });
});

describe("getFeaturedPlan", () => {
  const householdNow = createPlan({
    id: "household-now",
    startDate: "2026-11-09",
    endDate: "2026-11-15",
    participantIds: [ANA],
  });
  const ownNow = createPlan({
    id: "own-now",
    kind: "individual",
    startDate: "2026-11-09",
    endDate: "2026-11-15",
    participantIds: [MONIKA],
  });
  const householdNext = createPlan({ id: "household-next" });

  it("prefers the running plan the viewer eats from over a household plan they left for the week", () => {
    expect(getFeaturedPlan([householdNow, ownNow, householdNext], MONIKA, TODAY)).toBe(ownNow);
    expect(getFeaturedPlan([householdNow, ownNow, householdNext], ANA, TODAY)).toBe(householdNow);
  });

  it("prefers a later plan the viewer eats from over a running one they do not", () => {
    expect(getFeaturedPlan([householdNow, householdNext], MONIKA, TODAY)).toBe(householdNext);
  });

  it("falls back to the running plan, then the next one, when the viewer eats from none", () => {
    const outsider = "00000000-0000-0000-0000-000000000009";
    expect(getFeaturedPlan([householdNow, householdNext], outsider, TODAY)).toBe(householdNow);
    expect(getFeaturedPlan([householdNext], null, TODAY)).toBe(householdNext);
    expect(getFeaturedPlan([], MONIKA, TODAY)).toBeNull();
  });
});

describe("the New plan screen's address", () => {
  it("round-trips the viewer's own plan for a period", () => {
    const query = getOwnPlanQuery({ startDate: "2026-11-16", dayCount: 7 });
    expect(query).toEqual({ kind: "individual", start: "2026-11-16", days: "7" });
    expect(parseNewPlanQuery(query)).toEqual({ kind: "individual", startDate: "2026-11-16", dayCount: 7 });
  });

  it("ignores what is missing or not allowed", () => {
    expect(parseNewPlanQuery({})).toEqual({ kind: undefined, startDate: undefined, dayCount: undefined });
    expect(parseNewPlanQuery({ kind: "team", start: "2026-02-30", days: "15" })).toEqual({
      kind: undefined,
      startDate: undefined,
      dayCount: undefined,
    });
    expect(parseNewPlanQuery({ kind: ["individual"], start: null, days: "2.5" })).toEqual({
      kind: undefined,
      startDate: undefined,
      dayCount: undefined,
    });
    expect(parseNewPlanQuery({ kind: "household", days: "14" })).toEqual({
      kind: "household",
      startDate: undefined,
      dayCount: 14,
    });
  });
});
