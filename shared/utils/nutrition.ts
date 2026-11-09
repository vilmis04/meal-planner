/*
 * Nutrition on request (F1): what one participant eats per meal, per day and on average over a plan. Pure, so the
 * rules are unit tested and the plan page only shows the result.
 *
 * Every value is per person's portion, the same for everyone (product description, section 5), except where a
 * participant's diet needs a protein swap: then the swap's estimate is used, or the recipe's own macros when the
 * swap has none, and the meal is approximate. A meal whose macros are incomplete is shown but left out of the
 * totals, and the plan says how many were left out.
 */
import { swapNeeded } from "./recipeSwap";
import type { Diet } from "./diet";
import type {
  CompleteNutrition,
  DayNutrition,
  MacroShares,
  MealNutrition,
  Nutrition,
  NutritionRecipe,
  PlanNutrition,
  PlanNutritionInput,
  SwapNutritionByRecipe,
} from "./nutrition.types";

export function isNutritionComplete(nutrition: Nutrition): nutrition is CompleteNutrition {
  return (
    nutrition.caloriesKcal !== null &&
    nutrition.carbohydrates !== null &&
    nutrition.protein !== null &&
    nutrition.fat !== null
  );
}

// One meal as a participant with this diet eats it. A recipe the library does not know has no macros at all.
export function getMealNutrition(
  recipeId: string,
  recipe: NutritionRecipe | undefined,
  diet: Diet | null,
  swapNutrition: SwapNutritionByRecipe,
): MealNutrition {
  if (!recipe) {
    return { nutrition: EMPTY_NUTRITION, source: "recipe", isApproximate: false, isComplete: false };
  }
  if (!diet || !swapNeeded(diet, recipe.mainProteins)) {
    return {
      nutrition: recipe.nutrition,
      source: "recipe",
      isApproximate: false,
      isComplete: isNutritionComplete(recipe.nutrition),
    };
  }

  const swapped = swapNutrition.get(recipeId)?.[diet];
  if (swapped) {
    return { nutrition: swapped, source: "swap", isApproximate: true, isComplete: true };
  }
  return {
    nutrition: recipe.nutrition,
    source: "recipe_without_swap_estimate",
    isApproximate: true,
    isComplete: isNutritionComplete(recipe.nutrition),
  };
}

// Every filled slot's meal, each day's total and the average day, for one participant.
export function getPlanNutrition({ slots, dayCount, recipes, diet, swapNutrition }: PlanNutritionInput): PlanNutrition {
  const meals = new Map<string, MealNutrition>();
  const days: DayNutrition[] = Array.from({ length: dayCount }, (_, dayIndex) => ({
    dayIndex,
    total: null,
    countedMealCount: 0,
    excludedMealCount: 0,
    hasApproximateMeal: false,
  }));

  for (const slot of slots) {
    const day = days[slot.dayIndex];
    if (slot.recipeId === null || !day) {
      continue;
    }
    const meal = getMealNutrition(slot.recipeId, recipes.get(slot.recipeId), diet, swapNutrition);
    meals.set(slot.id, meal);

    if (!isNutritionComplete(meal.nutrition)) {
      day.excludedMealCount += 1;
      continue;
    }
    day.total = addNutrition(day.total ?? ZERO_NUTRITION, meal.nutrition);
    day.countedMealCount += 1;
    day.hasApproximateMeal ||= meal.isApproximate;
  }

  const totals = days.flatMap((day) => (day.total ? [day.total] : []));
  return {
    meals,
    days,
    dailyAverage: totals.length > 0 ? divideNutrition(totals.reduce(addNutrition, ZERO_NUTRITION), totals.length) : null,
    averagedDayCount: totals.length,
    excludedMealCount: days.reduce((count, day) => count + day.excludedMealCount, 0),
  };
}

// Whose view a plan opens on: the viewer's own when they eat from it, else its first participant; null for nobody.
export function getDefaultNutritionParticipant(
  participantIds: readonly string[],
  viewerId: string | null,
): string | null {
  if (viewerId !== null && participantIds.includes(viewerId)) {
    return viewerId;
  }
  return participantIds[0] ?? null;
}

// The share of energy each macro gives (4 kcal per gram of carbohydrate or protein, 9 per gram of fat), for the
// bar under a total. All zero when there is nothing.
export function getMacroEnergyShares(nutrition: CompleteNutrition): MacroShares {
  const carbohydrates = nutrition.carbohydrates * KCAL_PER_GRAM.carbohydrates;
  const protein = nutrition.protein * KCAL_PER_GRAM.protein;
  const fat = nutrition.fat * KCAL_PER_GRAM.fat;
  const energy = carbohydrates + protein + fat;
  if (energy === 0) {
    return { carbohydrates: 0, protein: 0, fat: 0 };
  }
  return {
    carbohydrates: carbohydrates / energy,
    protein: protein / energy,
    fat: fat / energy,
  };
}

const EMPTY_NUTRITION: Nutrition = { caloriesKcal: null, carbohydrates: null, protein: null, fat: null };
const ZERO_NUTRITION: CompleteNutrition = { caloriesKcal: 0, carbohydrates: 0, protein: 0, fat: 0 };
const KCAL_PER_GRAM = { carbohydrates: 4, protein: 4, fat: 9 } as const;

const addNutrition = (sum: CompleteNutrition, nutrition: CompleteNutrition): CompleteNutrition => ({
  caloriesKcal: sum.caloriesKcal + nutrition.caloriesKcal,
  carbohydrates: sum.carbohydrates + nutrition.carbohydrates,
  protein: sum.protein + nutrition.protein,
  fat: sum.fat + nutrition.fat,
});

const divideNutrition = (nutrition: CompleteNutrition, divisor: number): CompleteNutrition => ({
  caloriesKcal: nutrition.caloriesKcal / divisor,
  carbohydrates: nutrition.carbohydrates / divisor,
  protein: nutrition.protein / divisor,
  fat: nutrition.fat / divisor,
});
