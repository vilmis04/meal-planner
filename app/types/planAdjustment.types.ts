import type { Protein } from "#shared/utils/diet";
import type { MealType } from "#shared/utils/mealFilter";
import type { PlanAdjustment } from "#shared/utils/planAdjustment.types";

// One confirmed-to-be rule of an interpreted adjustment, as the confirmation lists it. index is its place in its own
// list of the constraints, so it can be taken out.
export type PlanConstraintRule =
  | { kind: "excluded_protein"; index: number; protein: Protein; dayIndexes: number[] | null; mealTypes: MealType[] | null }
  | {
      kind: "excluded_ingredient";
      index: number;
      ingredientName: string;
      dayIndexes: number[] | null;
      mealTypes: MealType[] | null;
    }
  | { kind: "quick_meals"; index: number; dayIndexes: number[] | null; mealTypes: MealType[] | null };

export type InterpretAdjustmentResult =
  | { isInterpreted: true; adjustment: PlanAdjustment }
  | { isInterpreted: false; errorKey: string };
