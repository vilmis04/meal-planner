import type { Diet } from "#shared/utils/diet";
import type { Page } from "#shared/utils/fetchAllPages";
import type { RecipeNutritionById, SwapNutritionResult } from "~/types/nutrition.types";

/*
 * Calories and macros (F1), read only once the user asks to see them. The library's macros are loaded whole, once,
 * like the recipe list (a row is about 60 bytes); swap estimates are read for the recipes and diets a plan needs.
 */
export function useRecipeNutrition() {
  const supabase = useSupabaseClient();
  const nutritionByRecipe = useState<RecipeNutritionById | null>("recipe-nutrition", () => null);
  const loadFailed = useState<boolean>("recipe-nutrition-load-failed", () => false);

  const fetchPage = async (from: number, to: number): Promise<Page<unknown>> => {
    const { data, error, count } = await supabase
      .from("recipes")
      .select(RECIPE_NUTRITION_COLUMNS, { count: "exact" })
      .order("id")
      .range(from, to);

    if (error) {
      throw error;
    }
    return { rows: data ?? [], total: count };
  };

  // Leaves the macros unknown on failure, so the page says so instead of showing every meal without data.
  const load = async (): Promise<void> => {
    let result: ReturnType<typeof recipeNutritionRowsSchema.safeParse> | null = null;
    let failure: unknown = null;
    try {
      result = recipeNutritionRowsSchema.safeParse(await fetchAllPages(fetchPage, RECIPE_PAGE_SIZE));
    } catch (error) {
      failure = error;
    }

    if (!result?.success) {
      console.error("Loading the nutrition failed", failure ?? result?.error);
      nutritionByRecipe.value = null;
      loadFailed.value = true;
      return;
    }

    nutritionByRecipe.value = result.data;
    loadFailed.value = false;
  };

  // The swap estimates for these recipes and diets. A plan holds at most 56 recipes and a household a few diets,
  // so one request is enough.
  const loadSwapNutrition = async (recipeIds: readonly string[], diets: readonly Diet[]): Promise<SwapNutritionResult> => {
    if (recipeIds.length === 0 || diets.length === 0) {
      return { status: "loaded", swapNutrition: {} };
    }

    const { data, error } = await supabase
      .from("recipe_protein_swaps")
      .select(SWAP_NUTRITION_COLUMNS)
      .eq("status", "ready")
      .eq("locale", DEFAULT_SWAP_LOCALE)
      .in("recipe_id", [...recipeIds])
      .in("diet", [...diets]);

    const result = error ? null : swapNutritionRowsSchema.safeParse(data);
    if (!result?.success) {
      console.error("Loading the swap nutrition failed", error ?? result?.error);
      return { status: "failed" };
    }
    return { status: "loaded", swapNutrition: result.data };
  };

  return {
    nutritionByRecipe: readonly(nutritionByRecipe),
    loadFailed: readonly(loadFailed),
    load,
    loadSwapNutrition,
  };
}
