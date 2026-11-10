import type { PlanKind } from "../../shared/utils/mealPlan";
import type { GeneratePlanResult } from "./planGenerationService.types";
import type { PlanGenerationStore } from "./planGenerationStore.types";
import type { PlanNotificationStore } from "./planNotificationStore.types";
import type { PlanScheduleStore } from "./scheduledPlanStore.types";
import type { RefreshShoppingListResult } from "./shoppingListService.types";
import type { ShoppingListStore } from "./shoppingListStore.types";

export interface ScheduledPlanDependencies {
  scheduleStore: PlanScheduleStore;
  generationStore: PlanGenerationStore;
  shoppingListStore: ShoppingListStore;
  notificationStore: PlanNotificationStore;
  // A fresh seed for each generated plan.
  createSeed: () => number;
  log?: (entry: Record<string, unknown>) => void;
}

// Whose plan it is: the individual schedule's owner, or the household (whose members are notified, H3).
interface ScheduleOwner {
  scheduleId: string;
  kind: PlanKind;
  userId: string | null;
  householdId: string | null;
}

// Where a schedule's run stopped: reading its clock, making the plan, generating it, building its list, or telling
// people about it.
export type ScheduledPlanStep = "schedule" | "create" | "generate" | "shopping_list" | "notify";

// What happened to one schedule that was due. "created" is the one people were told about (H3).
export type ScheduledPlanResult =
  | (ScheduleOwner & {
      status: "created";
      planId: string;
      startDate: string;
      endDate: string;
      // "generated", or why nothing was filled; the plan is a draft either way.
      generation: GeneratePlanResult["status"];
      shoppingList: RefreshShoppingListResult["status"];
      // People told about the plan now.
      notifiedCount: number;
    })
  // Made by an earlier run for this period and left as it is.
  | (ScheduleOwner & { status: "existing"; planId: string; startDate: string; endDate: string })
  // Turned off while the job ran.
  | (ScheduleOwner & { status: "disabled" })
  // planId is set when the plan was made before the failing step, so it exists as an (unfinished) draft. People are
  // still told about it unless telling them is what failed.
  | (ScheduleOwner & { status: "failed"; step: ScheduledPlanStep; planId: string | null; message: string });

export interface ScheduledPlanRun {
  ranAt: string;
  // Enabled schedules read; due ones are those whose run day is today on their own clock.
  scheduleCount: number;
  createdCount: number;
  existingCount: number;
  disabledCount: number;
  failedCount: number;
  // Due schedules only, in the order they ran.
  results: ScheduledPlanResult[];
}
