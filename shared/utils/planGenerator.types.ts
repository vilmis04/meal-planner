import type { Diet, Protein } from "./diet";
import type { MealType } from "./mealFilter";
import type { SLOT_FILL_NOTES } from "./planGenerator";
import type { RecipeRating } from "./recipeRating";

// Why a slot is empty or not filled the ideal way. Stored in meal_plan_slots.fill_note.
export type SlotFillNote = (typeof SLOT_FILL_NOTES)[number];

export interface GeneratorRecipe {
  id: string;
  mealType: MealType;
  portionDays: number;
  mainProteins: readonly Protein[];
}

export interface GeneratorParticipant {
  userId: string;
  diet: Diet;
  // Recipe id → this person's rating. Unrated recipes are missing.
  ratings: Readonly<Record<string, RecipeRating>>;
}

export interface GeneratorSlot {
  dayIndex: number;
  mealType: MealType;
  recipeId: string | null;
  // A locked slot is kept as it is; its recipe still counts towards repeats and the day's proteins.
  isLocked: boolean;
}

// The last date a recipe was planned in another plan of the same people, before this plan starts.
export interface RecipeLastUse {
  recipeId: string;
  lastPlannedOn: string;
}

export interface PlanGenerationInput {
  startDate: string;
  dayCount: number;
  // The meal types to fill; skipped snacks are left out.
  mealTypes: readonly MealType[];
  slots: readonly GeneratorSlot[];
  // ISO weekdays (1 = Monday) whose lunch and dinner get batch recipes first.
  workdays: readonly number[];
  recipes: readonly GeneratorRecipe[];
  participants: readonly GeneratorParticipant[];
  // Recipe id → the diets a ready protein swap exists for (D2). Such a recipe fits those diets too.
  swapDiets: Readonly<Record<string, readonly Diet[]>>;
  history: readonly RecipeLastUse[];
  cooldownDays: number;
  // Recipes the open slots must not get: a swap (E5) leaves out the recipe it replaces.
  excludedRecipeIds?: readonly string[];
  // Recipes particular open slots must not get, from a plan adjustment (I3) such as "no fish on Monday". Never relaxed.
  slotExclusions?: readonly SlotRecipeExclusion[];
  // Lunches and dinners a plan adjustment (I3) asks to be quick: planned like a workday's, from a batch cooked the day
  // before where one is left.
  quickMeals?: readonly PlannedMeal[];
  seed: number;
}

// One meal of one day of the plan.
export interface PlannedMeal {
  dayIndex: number;
  mealType: MealType;
}

export interface SlotRecipeExclusion extends PlannedMeal {
  recipeIds: readonly string[];
}

export interface SlotAssignment {
  dayIndex: number;
  mealType: MealType;
  recipeId: string | null;
  note: SlotFillNote | null;
}
