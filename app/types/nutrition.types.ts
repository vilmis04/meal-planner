import type { Diet } from "#shared/utils/diet";
import type { CompleteNutrition, Nutrition } from "#shared/utils/nutrition.types";

// Recipe id → its macros per person's portion (F1), for the whole library.
export type RecipeNutritionById = Record<string, Nutrition>;

// Recipe id → diet → the ready protein swap's estimate (D2).
export type SwapNutritionById = Record<string, Partial<Record<Diet, CompleteNutrition>>>;
export type SwapNutritionResult = { status: "loaded"; swapNutrition: SwapNutritionById } | { status: "failed" };
