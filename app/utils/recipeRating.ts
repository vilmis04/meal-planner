import { z } from "zod";

export const RECIPE_RATING_COLUMNS = "recipe_id, rating";

// Rows asked for per request when reading all of a user's ratings (see RECIPE_PAGE_SIZE for the 1000-row cap).
export const RECIPE_RATING_PAGE_SIZE = 1000;

// RECIPE_RATINGS is in shared/utils/recipeRating.ts and matches the user_recipe_preferences_rating_supported constraint.
export const recipeRatingRowsSchema = z
  .array(
    z.object({
      recipe_id: z.guid(),
      rating: z.enum(RECIPE_RATINGS),
    }),
  )
  .transform((rows) => Object.fromEntries(rows.map((row) => [row.recipe_id, row.rating])) as Record<string, RecipeRating>);

// How each rating looks wherever it is shown. The colors are Vuetify theme colors (nuxt.config.ts).
export const RECIPE_RATING_DISPLAY: Record<RecipeRating, { icon: string; color: string }> = {
  enjoy: { icon: "mdi-heart", color: "primary" },
  enjoy_less: { icon: "mdi-heart-half-full", color: "warning" },
  hate: { icon: "mdi-thumb-down-outline", color: "error" },
};

export const UNRATED_ICON = "mdi-heart-outline";
