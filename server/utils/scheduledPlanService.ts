/*
 * Scheduled plans (H2): every enabled schedule whose run day is today, on the schedule's own clock, gets the plan for
 * its next period, generated (E4) and with its shopping list built (G2). The plan is an ordinary draft people change
 * as they like.
 *
 * Running again is safe: create_scheduled_meal_plan() keeps one plan per schedule and period, and a plan an earlier
 * run made is left as it is (not generated again), whatever happened to it since. A run day that was missed (the job
 * did not run that day) is not caught up later.
 *
 * Reading the schedules is the one thing every schedule needs, so it failing fails the run. After that each schedule
 * stands alone: one that fails is logged and reported, and the others go on.
 */
import { getDateInTimeZone, getScheduleRun } from "../../shared/utils/planSchedule";
import type { ScheduleRun } from "../../shared/utils/planSchedule.types";
import { getErrorMessage, writeJsonLog } from "./jsonLog";
import { generatePlan } from "./planGenerationService";
import type {
  ScheduledPlanDependencies,
  ScheduledPlanResult,
  ScheduledPlanRun,
  ScheduledPlanStep,
} from "./scheduledPlanService.types";
import type { StoredPlanSchedule } from "./scheduledPlanStore.types";
import { refreshShoppingList } from "./shoppingListService";

export async function createScheduledPlans(
  dependencies: ScheduledPlanDependencies,
  { now }: { now: Date },
): Promise<ScheduledPlanRun> {
  const { scheduleStore, log = writeJsonLog } = dependencies;
  const startedAt = Date.now();
  const schedules = await scheduleStore.loadEnabledSchedules();

  // One schedule at a time: the job is not in a hurry, and the database serves people meanwhile.
  const results: ScheduledPlanResult[] = [];
  for (const schedule of schedules) {
    const result = await runSchedule({ ...dependencies, log }, schedule, now);
    if (result !== null) {
      results.push(result);
    }
  }

  const summary: Omit<ScheduledPlanRun, "results"> = {
    ranAt: now.toISOString(),
    scheduleCount: schedules.length,
    createdCount: countByStatus(results, "created"),
    existingCount: countByStatus(results, "existing"),
    disabledCount: countByStatus(results, "disabled"),
    failedCount: countByStatus(results, "failed"),
  };
  log({ event: "scheduled_plans_run", ...summary, durationMs: Date.now() - startedAt });
  return { ...summary, results };
}

// Null when the schedule is not due today.
const runSchedule = async (
  {
    scheduleStore,
    generationStore,
    shoppingListStore,
    createSeed,
    log,
  }: Required<ScheduledPlanDependencies>,
  schedule: StoredPlanSchedule,
  now: Date,
): Promise<ScheduledPlanResult | null> => {
  const owner = {
    scheduleId: schedule.id,
    kind: schedule.kind,
    userId: schedule.userId,
    householdId: schedule.householdId,
  };
  let step: ScheduledPlanStep = "schedule";
  let planId: string | null = null;

  try {
    const run = getDueRun(schedule, now);
    if (run === null) {
      return null;
    }
    const period = { startDate: run.startDate, endDate: run.endDate };

    step = "create";
    const creation = await scheduleStore.createPlan(schedule.id, run.startDate);
    if (creation.status === "disabled") {
      log({ event: "scheduled_plan_disabled", ...owner });
      return { ...owner, status: "disabled" };
    }
    if (creation.status === "existing") {
      log({ event: "scheduled_plan_existing", ...owner, planId: creation.planId, ...period });
      return { ...owner, status: "existing", planId: creation.planId, ...period };
    }
    planId = creation.planId;

    step = "generate";
    const generation = await generatePlan({ store: generationStore, createSeed, log }, { planId });

    step = "shopping_list";
    const shoppingList = await refreshShoppingList({ store: shoppingListStore }, { planId });

    const result: ScheduledPlanResult = {
      ...owner,
      status: "created",
      planId,
      ...period,
      generation: generation.status,
      shoppingList: shoppingList.status,
    };
    log({ event: "scheduled_plan_created", ...result });
    return result;
  } catch (error) {
    const result: ScheduledPlanResult = { ...owner, status: "failed", step, planId, message: getErrorMessage(error) };
    log({ event: "scheduled_plan_failed", level: "error", ...result });
    return result;
  }
};

// Today on the schedule's clock, when it is the schedule's run day.
const getDueRun = (schedule: StoredPlanSchedule, now: Date): ScheduleRun | null => {
  const today = getDateInTimeZone(schedule.timeZone, now);
  const run = getScheduleRun(schedule, today);
  return run.runDate === today ? run : null;
};

const countByStatus = (results: readonly ScheduledPlanResult[], status: ScheduledPlanResult["status"]): number =>
  results.filter((result) => result.status === status).length;
