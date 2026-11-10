import { randomInt } from "node:crypto";
import { SEED_LIMIT } from "#shared/utils/seededRandom";

/*
 * POST /api/cron/create-plans: the scheduled plan job (H2). The scheduler (a Coolify scheduled task, see README,
 * "Scheduled plans") calls it once a day, or more often: every call is safe to repeat. It makes the plan of every
 * enabled schedule whose run day is today on its own clock, generates it and builds its shopping list
 * (scheduledPlanService.ts). Header: "Authorization: Bearer <NUXT_CRON_SECRET>".
 *
 *   200 ScheduledPlanRun                    every due schedule has its plan (results say which were made now)
 *   500 ScheduledPlanRun                    some schedules failed (each is logged); the others have their plans
 *   500                                     the job is not configured, or the schedules could not be read
 *   401                                     no or a wrong secret
 */
export default defineEventHandler(async (event) => {
  const { cronSecret, supabaseServiceRoleKey } = useRuntimeConfig(event);
  // Configuration mistakes stop the job before it touches anything, and say what to fix.
  if (cronSecret.length < CRON_SECRET_MIN_LENGTH) {
    writeJsonLog({ event: "scheduled_plans_not_configured", level: "error", reason: "NUXT_CRON_SECRET" });
    throw createError({ statusCode: 500, statusMessage: "Scheduled jobs are not configured" });
  }
  if (!supabaseServiceRoleKey) {
    writeJsonLog({ event: "scheduled_plans_not_configured", level: "error", reason: "NUXT_SUPABASE_SERVICE_ROLE_KEY" });
    throw createError({ statusCode: 500, statusMessage: "Scheduled jobs are not configured" });
  }
  if (!isCronRequestAuthorized(getHeader(event, "authorization"), cronSecret)) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const serviceClient = useServiceRoleClient(event);
  try {
    const run = await createScheduledPlans(
      {
        scheduleStore: createSupabasePlanScheduleStore(serviceClient),
        generationStore: createServiceRolePlanGenerationStore(serviceClient),
        shoppingListStore: createServiceRoleShoppingListStore(serviceClient),
        createSeed: () => randomInt(SEED_LIMIT),
      },
      { now: new Date() },
    );
    if (run.failedCount > 0) {
      setResponseStatus(event, 500);
    }
    return run;
  } catch (error) {
    writeJsonLog({ event: "scheduled_plans_run_failed", level: "error", message: getErrorMessage(error) });
    throw createError({ statusCode: 500, statusMessage: "Scheduled plans could not be created" });
  }
});
