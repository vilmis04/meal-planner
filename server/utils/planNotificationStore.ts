/*
 * The plan created notices (H3), written as the service role: create_plan_created_notifications() is for the service
 * role only, and decides who is told (see 20261120000000_create_notifications.sql).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanNotificationStore } from "./planNotificationStore.types";
import { notifiedCountSchema } from "./scheduledPlan.schema";

export function createSupabasePlanNotificationStore(serviceClient: SupabaseClient): PlanNotificationStore {
  return {
    async notifyPlanCreated(planId) {
      const { data, error } = await serviceClient.rpc("create_plan_created_notifications", { target_plan_id: planId });
      if (error) throw new Error(`Notifying the members of plan ${planId} failed: ${error.message}`);
      return notifiedCountSchema.parse(data);
    },
  };
}
