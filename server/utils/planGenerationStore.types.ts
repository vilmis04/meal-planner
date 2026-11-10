import type { Diet } from "../../shared/utils/diet";
import type { MealType } from "../../shared/utils/mealFilter";
import type { PlanKind } from "../../shared/utils/mealPlan";
import type {
  GeneratorParticipant,
  GeneratorRecipe,
  RecipeLastUse,
  SlotAssignment,
} from "../../shared/utils/planGenerator.types";

// The plan as the signed-in user's own client reads it, so row level security decides whether they may open it (the
// service role reads the scheduled job's plans).
export interface StoredPlan {
  id: string;
  kind: PlanKind;
  startDate: string;
  dayCount: number;
  includeSnacks: boolean;
  workdays: number[];
  cooldownDays: number;
  slots: StoredSlot[];
}

export interface StoredSlot {
  id: string;
  dayIndex: number;
  mealType: MealType;
  recipeId: string | null;
  // As stored; a slot without a recipe counts as open whatever this says (isSlotLocked()).
  isLocked: boolean;
}

// One generated slot as it is written, with the recipe the slot held when the plan was read, so the database can
// refuse the write when someone changed the slot meanwhile (E5).
export interface SlotWrite extends SlotAssignment {
  previousRecipeId: string | null;
}

// Where the generator's inputs come from and where its plan goes. The service depends on this interface only, so
// it is tested with an in-memory store.
export interface PlanGenerationStore {
  // Null when the plan does not exist or the signed-in user cannot open it.
  loadPlan(planId: string): Promise<StoredPlan | null>;
  loadRecipes(): Promise<GeneratorRecipe[]>;
  // Recipe id → diets a ready protein swap exists for.
  loadSwapDiets(): Promise<Record<string, Diet[]>>;
  // Ingredient id → the recipes that use it (G1's aliases), for a plan adjustment's excluded ingredients (I3).
  loadIngredientRecipeIds(ingredientIds: readonly string[]): Promise<Record<string, string[]>>;
  // Service role: the participants with their diets and every rating they gave.
  loadParticipants(planId: string): Promise<GeneratorParticipant[]>;
  // Service role: the participants' other plans within `lookbackDays` before this one starts.
  loadHistory(planId: string, lookbackDays: number): Promise<RecipeLastUse[]>;
  // As the signed-in user (the service role for a scheduled plan). "plan-changed" when a slot no longer holds its previous recipe, or was locked meanwhile;
  // nothing is written then.
  applyGeneration(planId: string, writes: readonly SlotWrite[]): Promise<"applied" | "plan-changed">;
  // A swap (E5) as the signed-in user: written as applyGeneration() writes, and the recipes it replaced are recorded as
  // skipped (I2, apply_meal_plan_swap()).
  applySwap(planId: string, writes: readonly SlotWrite[]): Promise<"applied" | "plan-changed">;
}
