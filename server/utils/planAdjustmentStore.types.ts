import type { PlanAdjustment, AdjustmentIngredient } from "../../shared/utils/planAdjustment.types";

// What the interpretation needs to know about the plan: its days and the meal types it shows.
export interface AdjustablePlan {
  id: string;
  startDate: string;
  dayCount: number;
  includeSnacks: boolean;
}

// Where the plan adjustment service reads and caches. The service depends on this interface only, so it is tested
// with an in-memory store.
export interface PlanAdjustmentStore {
  // As the signed-in user: null when the plan does not exist or they cannot open it.
  loadPlan(planId: string): Promise<AdjustablePlan | null>;
  // The canonical ingredients (G1), by name.
  loadIngredients(): Promise<AdjustmentIngredient[]>;
  // Service role: a cached interpretation, or null (also when the stored one no longer parses).
  loadInterpretation(promptHash: string): Promise<PlanAdjustment | null>;
  saveInterpretation(promptHash: string, model: string, adjustment: PlanAdjustment): Promise<void>;
}
