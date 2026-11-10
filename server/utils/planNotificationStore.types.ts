// Where the scheduled plan job (H2) tells people about the plans it made (H3). The service depends on this interface
// only, so it is tested with an in-memory store. Runs as the service role.
export interface PlanNotificationStore {
  // Tells the people the plan concerns that it was made, once per person; returns how many were told now.
  notifyPlanCreated(planId: string): Promise<number>;
}
