import type { MealType } from "#shared/utils/mealFilter";

interface InsightMeal {
  id: string;
  name: string;
  mealType: MealType;
}

export interface LikedMeal extends InsightMeal {
  // Meals of it on the plans the viewer eats from, dated from the range's start on (upcoming ones too).
  plannedCount: number;
}

export interface SkippedMeal extends InsightMeal {
  // Times it was taken out of a slot of those plans (swapped, replaced or cleared) in the range.
  skipCount: number;
}

// The viewer's most liked and most skipped meals over a range (I2), as get_preference_insights() returns them.
export interface PreferenceInsights {
  // The enjoy-rated recipes, most planned first.
  liked: LikedMeal[];
  // Every enjoy rating, whatever the range.
  likedCount: number;
  // The most skipped recipes first.
  skipped: SkippedMeal[];
  // Every skip in the range.
  skipCount: number;
}

export type PreferenceInsightsLoadResult = { status: "loaded"; insights: PreferenceInsights } | { status: "failed" };

// A meal as a list on the preference insights page shows it: how often it counted, as text.
export interface InsightMealRow extends InsightMeal {
  countText: string;
}
