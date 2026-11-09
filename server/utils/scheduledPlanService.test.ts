import { describe, expect, it, vi } from "vitest";
import { MEAL_TYPES } from "../../shared/utils/mealFilter";
import type { PlanGenerationStore, StoredPlan } from "./planGenerationStore.types";
import { createScheduledPlans } from "./scheduledPlanService";
import type { ScheduledPlanDependencies } from "./scheduledPlanService.types";
import type { PlanScheduleStore, ScheduledPlanCreation, StoredPlanSchedule } from "./scheduledPlanStore.types";
import type { ShoppingListStore, StoredShoppingPlan } from "./shoppingListStore.types";

// Saturday 14 Nov 2026, 06:00 UTC: Saturday in Vilnius and New York, still Friday in Honolulu (UTC-10).
const SATURDAY_MORNING = new Date("2026-11-14T06:00:00Z");

const makeSchedule = (overrides: Partial<StoredPlanSchedule> = {}): StoredPlanSchedule => ({
  id: "home-schedule",
  kind: "household",
  userId: null,
  householdId: "home",
  createWeekday: 6,
  startWeekday: 1,
  dayCount: 2,
  timeZone: "Europe/Vilnius",
  ...overrides,
});

/*
 * In-memory stores: create_scheduled_meal_plan()'s one plan per schedule and start, a plan made with empty slots for
 * the generator, and a shopping list that is out of date until built. The SQL itself is tested in supabase/tests.
 */
const makeDependencies = (
  schedules: StoredPlanSchedule[],
  { createPlan }: { createPlan?: PlanScheduleStore["createPlan"] } = {},
) => {
  const plans = new Map<string, StoredPlan>();
  const planKeys = new Map<string, string>();
  const builtLists = new Set<string>();

  const scheduleStore: PlanScheduleStore = {
    loadEnabledSchedules: async () => schedules,
    createPlan:
      createPlan ??
      (async (scheduleId, startDate): Promise<ScheduledPlanCreation> => {
        const key = `${scheduleId}|${startDate}`;
        const existingId = planKeys.get(key);
        if (existingId !== undefined) {
          return { status: "existing", planId: existingId };
        }
        const schedule = schedules.find((candidate) => candidate.id === scheduleId);
        const planId = `plan-${plans.size + 1}`;
        planKeys.set(key, planId);
        plans.set(planId, {
          id: planId,
          kind: schedule?.kind ?? "household",
          startDate,
          dayCount: schedule?.dayCount ?? 1,
          includeSnacks: true,
          workdays: [1, 2, 3, 4, 5],
          cooldownDays: 14,
          slots: Array.from({ length: schedule?.dayCount ?? 1 }, (_, dayIndex) =>
            MEAL_TYPES.map((mealType) => ({ id: `${planId}-${dayIndex}-${mealType}`, dayIndex, mealType, recipeId: null, isLocked: false })),
          ).flat(),
        });
        return { status: "created", planId };
      }),
  };

  const generationStore: PlanGenerationStore = {
    loadPlan: async (planId) => plans.get(planId) ?? null,
    loadRecipes: async () => [{ id: "stew", mealType: "dinner", portionDays: 1, mainProteins: ["plant"] }],
    loadSwapDiets: async () => ({}),
    loadParticipants: async () => [{ userId: "ana", diet: "full", ratings: {} }],
    loadHistory: async () => [],
    applyGeneration: vi.fn(async () => "applied" as const),
  };

  const shoppingListStore: ShoppingListStore = {
    loadPlan: async (planId): Promise<StoredShoppingPlan | null> =>
      plans.has(planId)
        ? {
            id: planId,
            includeSnacks: true,
            snacksOnList: true,
            slots: [],
            participantIds: ["ana"],
            sourceVersion: 1,
            generatedVersion: builtLists.has(planId) ? 1 : 0,
          }
        : null,
    loadDiets: async () => new Map(),
    loadRecipes: async () => new Map(),
    loadSwaps: async () => new Map(),
    loadAliases: async () => new Map(),
    applyList: vi.fn(async (planId: string) => {
      builtLists.add(planId);
      return "applied" as const;
    }),
  };

  const log = vi.fn();
  const dependencies: ScheduledPlanDependencies = {
    scheduleStore,
    generationStore,
    shoppingListStore,
    createSeed: () => 7,
    log,
  };
  return { dependencies, plans, log, generationStore, shoppingListStore };
};

describe("createScheduledPlans", () => {
  it("makes, generates and lists the plan of a schedule due today (AC1, AC3)", async () => {
    const { dependencies, plans, generationStore, shoppingListStore } = makeDependencies([makeSchedule()]);

    const run = await createScheduledPlans(dependencies, { now: SATURDAY_MORNING });

    expect(run).toMatchObject({ scheduleCount: 1, createdCount: 1, existingCount: 0, failedCount: 0 });
    expect(run.results).toEqual([
      {
        scheduleId: "home-schedule",
        kind: "household",
        userId: null,
        householdId: "home",
        status: "created",
        planId: "plan-1",
        startDate: "2026-11-16",
        endDate: "2026-11-17",
        generation: "generated",
        shoppingList: "refreshed",
      },
    ]);
    expect(plans.get("plan-1")?.startDate).toBe("2026-11-16");
    expect(generationStore.applyGeneration).toHaveBeenCalledTimes(1);
    expect(shoppingListStore.applyList).toHaveBeenCalledTimes(1);
  });

  it("does not make a second plan when it runs again (AC2)", async () => {
    const { dependencies, plans, generationStore } = makeDependencies([makeSchedule()]);

    await createScheduledPlans(dependencies, { now: SATURDAY_MORNING });
    const second = await createScheduledPlans(dependencies, { now: new Date("2026-11-14T18:00:00Z") });

    expect(second).toMatchObject({ createdCount: 0, existingCount: 1, failedCount: 0 });
    expect(second.results[0]).toMatchObject({ status: "existing", planId: "plan-1" });
    expect(plans.size).toBe(1);
    // The plan is left as people may have changed it since.
    expect(generationStore.applyGeneration).toHaveBeenCalledTimes(1);
  });

  it("goes by each schedule's own clock", async () => {
    const { dependencies } = makeDependencies([
      makeSchedule({ id: "vilnius" }),
      makeSchedule({ id: "new-york", timeZone: "America/New_York" }),
      // Still Friday there: its Saturday run comes with a later call.
      makeSchedule({ id: "honolulu", timeZone: "Pacific/Honolulu" }),
      makeSchedule({ id: "friday", createWeekday: 5 }),
    ]);

    const run = await createScheduledPlans(dependencies, { now: SATURDAY_MORNING });

    expect(run.scheduleCount).toBe(4);
    expect(run.results.map((result) => result.scheduleId)).toEqual(["vilnius", "new-york"]);
  });

  it("makes the run day's plan late in the evening, before the date turns", async () => {
    // Friday 13 Nov 22:30 UTC is Saturday 00:30 in Vilnius.
    const { dependencies } = makeDependencies([makeSchedule()]);

    const run = await createScheduledPlans(dependencies, { now: new Date("2026-11-13T22:30:00Z") });

    expect(run.results[0]).toMatchObject({ status: "created", startDate: "2026-11-16" });
  });

  it("keeps going when one schedule fails, and says where it stopped (AC3)", async () => {
    const { dependencies, log } = makeDependencies(
      [makeSchedule({ id: "broken" }), makeSchedule({ id: "fine" })],
    );
    const createPlan = dependencies.scheduleStore.createPlan;
    dependencies.scheduleStore.createPlan = async (scheduleId, startDate) => {
      if (scheduleId === "broken") throw new Error("connection reset");
      return createPlan(scheduleId, startDate);
    };

    const run = await createScheduledPlans(dependencies, { now: SATURDAY_MORNING });

    expect(run).toMatchObject({ createdCount: 1, failedCount: 1 });
    expect(run.results[0]).toEqual({
      scheduleId: "broken",
      kind: "household",
      userId: null,
      householdId: "home",
      status: "failed",
      step: "create",
      planId: null,
      message: "connection reset",
    });
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ event: "scheduled_plan_failed", level: "error", scheduleId: "broken" }),
    );
  });

  it("reports a plan that was made but not generated, so it is not lost", async () => {
    const { dependencies } = makeDependencies([makeSchedule()]);
    dependencies.generationStore.loadRecipes = async () => {
      throw new Error("timeout");
    };

    const run = await createScheduledPlans(dependencies, { now: SATURDAY_MORNING });

    expect(run.results[0]).toMatchObject({ status: "failed", step: "generate", planId: "plan-1", message: "timeout" });
  });

  it("reports a list that could not be built", async () => {
    const { dependencies } = makeDependencies([makeSchedule()]);
    dependencies.shoppingListStore.loadPlan = async () => {
      throw new Error("timeout");
    };

    const run = await createScheduledPlans(dependencies, { now: SATURDAY_MORNING });

    expect(run.results[0]).toMatchObject({ status: "failed", step: "shopping_list", planId: "plan-1" });
  });

  it("fails a schedule whose time zone is unknown, and only that one", async () => {
    const { dependencies } = makeDependencies([makeSchedule({ id: "nowhere", timeZone: "Mars/Olympus_Mons" }), makeSchedule()]);

    const run = await createScheduledPlans(dependencies, { now: SATURDAY_MORNING });

    expect(run.results.map((result) => [result.scheduleId, result.status])).toEqual([
      ["nowhere", "failed"],
      ["home-schedule", "created"],
    ]);
    expect(run.results[0]).toMatchObject({ step: "schedule", planId: null });
  });

  it("skips a schedule turned off while the job ran", async () => {
    const { dependencies } = makeDependencies([makeSchedule()], { createPlan: async () => ({ status: "disabled" }) });

    const run = await createScheduledPlans(dependencies, { now: SATURDAY_MORNING });

    expect(run).toMatchObject({ disabledCount: 1, failedCount: 0 });
    expect(run.results[0]).toMatchObject({ status: "disabled" });
  });

  it("keeps a plan nobody can be planned for as an empty draft", async () => {
    const { dependencies } = makeDependencies([makeSchedule()]);
    dependencies.generationStore.loadParticipants = async () => [];

    const run = await createScheduledPlans(dependencies, { now: SATURDAY_MORNING });

    expect(run.results[0]).toMatchObject({ status: "created", generation: "no-participants" });
  });

  it("fails the whole run when the schedules cannot be read", async () => {
    const { dependencies } = makeDependencies([]);
    dependencies.scheduleStore.loadEnabledSchedules = async () => {
      throw new Error("permission denied");
    };

    await expect(createScheduledPlans(dependencies, { now: SATURDAY_MORNING })).rejects.toThrow("permission denied");
  });

  it("logs a summary of the run", async () => {
    const { dependencies, log } = makeDependencies([makeSchedule(), makeSchedule({ id: "friday", createWeekday: 5 })]);

    await createScheduledPlans(dependencies, { now: SATURDAY_MORNING });

    expect(log).toHaveBeenLastCalledWith(
      expect.objectContaining({
        event: "scheduled_plans_run",
        ranAt: "2026-11-14T06:00:00.000Z",
        scheduleCount: 2,
        createdCount: 1,
        failedCount: 0,
      }),
    );
  });
});
