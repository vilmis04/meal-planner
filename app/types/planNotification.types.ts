import type { z } from "zod";
import type { planNotificationRowsSchema } from "~/utils/planNotification";

// "Your next draft is ready" (H3): an unread notice of a plan the scheduled job made.
export type PlanNotification = z.output<typeof planNotificationRowsSchema>[number];
export type PlanNotificationsLoadResult = { status: "loaded"; notifications: PlanNotification[] } | { status: "failed" };
