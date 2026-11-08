import type { Diet } from "../../shared/utils/diet";
import type { MealType } from "../../shared/utils/mealFilter";
import type { PlanKind } from "../../shared/utils/mealPlan";
import type {
  GeneratorParticipant,
  GeneratorRecipe,
  RecipeLastUse,
  SlotAssignment,
} from "../../shared/utils/planGenerator.types";

// The plan as the signed-in user's own client reads it, so row level security decides whether they may open it.
export interface StoredPlan {
  id: string;
  kind: PlanKind;
  startDate: string;
  dayCount: number;
  includeSnacks: boolean;
  workdays: number[];
  cooldownDays: number;
  slots: { dayIndex: number; mealType: MealType; recipeId: string | null }[];
}

// Where the generator's inputs come from and where its plan goes. The service depends on this interface only, so
// it is tested with an in-memory store.
export interface PlanGenerationStore {
  // Null when the plan does not exist or the signed-in user cannot open it.
  loadPlan(planId: string): Promise<StoredPlan | null>;
  loadRecipes(): Promise<GeneratorRecipe[]>;
  // Recipe id → diets a ready protein swap exists for.
  loadSwapDiets(): Promise<Record<string, Diet[]>>;
  // Service role: the participants with their diets and every rating they gave.
  loadParticipants(planId: string): Promise<GeneratorParticipant[]>;
  // Service role: the participants' other plans within `lookbackDays` before this one starts.
  loadHistory(planId: string, lookbackDays: number): Promise<RecipeLastUse[]>;
  // As the signed-in user. "plan-changed" when a slot was filled meanwhile; nothing is written then.
  applyGeneration(planId: string, assignments: readonly SlotAssignment[]): Promise<"applied" | "plan-changed">;
}
