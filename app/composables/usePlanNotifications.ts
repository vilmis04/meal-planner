import type { PlanNotificationsLoadResult } from "~/types/planNotification.types";

// Notices of plans the scheduled job made (H3). Row level security shows the viewer their own, and only while they can
// open the plan; mark_plan_notifications_read() marks the viewer's notices of a plan read.
export function usePlanNotifications() {
  const supabase = useSupabaseClient();

  // Unread notices of plans that are not over on the viewer's date `today`, newest first.
  const loadUnread = async (today: string): Promise<PlanNotificationsLoadResult> => {
    const { data, error } = await supabase
      .from("notifications")
      .select(PLAN_NOTIFICATION_COLUMNS)
      .eq("kind", "plan_created")
      .is("read_at", null)
      .gte("meal_plans.end_date", today)
      .order("created_at", { ascending: false })
      .limit(PLAN_NOTIFICATION_LIMIT);

    const result = error ? null : planNotificationRowsSchema.safeParse(data);
    if (!result?.success) {
      console.error("Loading the notices failed", error ?? result?.error);
      return { status: "failed" };
    }
    return { status: "loaded", notifications: result.data };
  };

  // A notice that stays unread only shows again, so a failure is logged and not shown.
  const markPlanRead = async (planId: string): Promise<void> => {
    const { error } = await supabase.rpc("mark_plan_notifications_read", { target_plan_id: planId });
    if (error) {
      console.error("Marking the plan's notices read failed", error);
    }
  };

  return { loadUnread, markPlanRead };
}
