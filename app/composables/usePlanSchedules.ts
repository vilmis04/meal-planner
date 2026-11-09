import type { PlanKind } from "#shared/utils/mealPlan";
import type { PlanScheduleSettings } from "#shared/utils/planSchedule.types";
import type { PlanSchedulesLoadResult, SavePlanScheduleResult } from "~/types/planSchedule.types";

// Automatic plan creation settings (H1). Row level security shows the viewer's own schedule and their household's;
// save_plan_schedule() lets a person save their own and the household's owner the household's.
export function usePlanSchedules() {
  const supabase = useSupabaseClient();

  const load = async (): Promise<PlanSchedulesLoadResult> => {
    const { data, error } = await supabase.from("plan_schedules").select(PLAN_SCHEDULE_COLUMNS);

    const result = error ? null : planScheduleRowsSchema.safeParse(data);
    if (!result?.success) {
      console.error("Loading the schedules failed", error ?? result?.error);
      return { status: "failed" };
    }
    return { status: "loaded", schedules: result.data };
  };

  // Saves every setting at once, so the last save wins whole. The household is never sent: the database takes the
  // caller's own. The browser's time zone becomes the schedule's, so its weekday is the saver's weekday.
  const save = async (kind: PlanKind, settings: PlanScheduleSettings): Promise<SavePlanScheduleResult> => {
    const { error } = await supabase.rpc("save_plan_schedule", {
      schedule_kind: kind,
      schedule_is_enabled: settings.isEnabled,
      schedule_create_weekday: settings.createWeekday,
      schedule_start_weekday: settings.startWeekday,
      schedule_day_count: settings.dayCount,
      schedule_snacks_on_list: settings.snacksOnList,
      schedule_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...(kind === "household" && settings.participantIds ? { schedule_participant_ids: settings.participantIds } : {}),
    });

    if (error) {
      console.error("Saving the schedule failed", error);
      return { isSaved: false, errorKey: getPlanScheduleErrorKey(error) };
    }
    return { isSaved: true };
  };

  return { load, save };
}
