import { z } from "zod";
import { MEAL_TYPES } from "#shared/utils/mealFilter";
import type { RecipeRating } from "#shared/utils/recipeRating";
import type { LikedMeal, PreferenceInsights } from "~/types/preferenceInsights.types";

// The recipes get_preference_insights() returns in each list (top_count in
// supabase/migrations/20261123000000_add_preference_insights.sql).
const PREFERENCE_INSIGHT_TOP_COUNT = 5;

const countSchema = z.number().int().min(0);

// MEAL_TYPES matches the public.meal_type enum.
const insightMealSchema = z.object({ id: z.guid(), name: z.string(), meal_type: z.enum(MEAL_TYPES) });

// What get_preference_insights() returns: the viewer's enjoy-rated recipes, most planned first, and the most skipped
// recipes on their plans, each list at most five long, with the totals behind them.
export const preferenceInsightsSchema = z
  .object({
    liked: z.array(insightMealSchema.extend({ planned_count: countSchema })).max(PREFERENCE_INSIGHT_TOP_COUNT),
    liked_count: countSchema,
    skipped: z.array(insightMealSchema.extend({ skip_count: countSchema.min(1) })).max(PREFERENCE_INSIGHT_TOP_COUNT),
    skip_count: countSchema,
  })
  .transform(
    (row): PreferenceInsights => ({
      liked: row.liked.map((meal) => ({
        id: meal.id,
        name: meal.name,
        mealType: meal.meal_type,
        plannedCount: meal.planned_count,
      })),
      likedCount: row.liked_count,
      skipped: row.skipped.map((meal) => ({
        id: meal.id,
        name: meal.name,
        mealType: meal.meal_type,
        skipCount: meal.skip_count,
      })),
      skipCount: row.skip_count,
    }),
  );

// The liked meals still rated enjoy: a meal rated otherwise on the page leaves the list at once. Without the ratings
// (still loading, or failed) the list is shown as it was read.
export function getStillLikedMeals(
  liked: readonly LikedMeal[],
  ratings: Readonly<Record<string, RecipeRating>> | null,
): LikedMeal[] {
  return ratings ? liked.filter((meal) => ratings[meal.id] === "enjoy") : [...liked];
}
