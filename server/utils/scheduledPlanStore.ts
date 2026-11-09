/*
 * Where the scheduled plan job (H2) reads the enabled schedules and makes their plans, as the service role: no one is
 * signed in, and create_scheduled_meal_plan() is for the service role only. The function decides who eats from the
 * plan and keeps one plan per schedule and period (see 20261119000000_add_scheduled_meal_plans.sql).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "../../shared/utils/fetchAllPages";
import type { Page } from "../../shared/utils/fetchAllPages";
import { SCHEDULE_COLUMNS, createdPlanRowsSchema, scheduleRowSchema } from "./scheduledPlan.schema";
import type { PlanScheduleStore } from "./scheduledPlanStore.types";

// Supabase answers at most 1000 rows per request (silently), so the schedules are read in pages.
const PAGE_SIZE = 1000;

export function createSupabasePlanScheduleStore(serviceClient: SupabaseClient): PlanScheduleStore {
  return {
    async loadEnabledSchedules() {
      const fetchPage = async (from: number, to: number): Promise<Page<unknown>> => {
        const { data, error, count } = await serviceClient
          .from("plan_schedules")
          .select(SCHEDULE_COLUMNS, { count: "exact" })
          .eq("is_enabled", true)
          .order("id")
          .range(from, to);
        if (error) throw new Error(`Loading the enabled plan schedules failed: ${error.message}`);
        return { rows: data ?? [], total: count };
      };
      const rows = await fetchAllPages(fetchPage, PAGE_SIZE);
      return rows.map((row) => scheduleRowSchema.parse(row));
    },

    async createPlan(scheduleId, startDate) {
      const { data, error } = await serviceClient.rpc("create_scheduled_meal_plan", {
        target_schedule_id: scheduleId,
        plan_start_date: startDate,
      });
      if (error?.message === "schedule_disabled") return { status: "disabled" };
      if (error) throw new Error(`Creating the plan of schedule ${scheduleId} failed: ${error.message}`);

      const { meal_plan_id: planId, is_created: isCreated } = createdPlanRowsSchema.parse(data);
      return isCreated ? { status: "created", planId } : { status: "existing", planId };
    },
  };
}
