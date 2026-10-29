import type { RecipeLoadResult, RecipeSummary } from "~/types/recipe.types";

export function useRecipes() {
  const supabase = useSupabaseClient();
  // The whole library is about 120 rows, so it is loaded once and filtered in the browser.
  const recipes = useState<RecipeSummary[] | null>("recipes", () => null);
  const loadFailed = useState<boolean>("recipes-load-failed", () => false);

  // Leaves the list empty on failure so the page can show an error and try again on the next visit.
  const loadList = async (): Promise<void> => {
    const { data, error } = await supabase
      .from("recipes")
      .select(RECIPE_LIST_COLUMNS)
      .order("name");

    const result = error ? null : recipeListRowsSchema.safeParse(data);
    if (!result?.success) {
      console.error("Loading the recipes failed", error ?? result?.error);
      recipes.value = null;
      loadFailed.value = true;
      return;
    }

    recipes.value = result.data;
    loadFailed.value = false;
  };

  const loadRecipe = async (id: string): Promise<RecipeLoadResult> => {
    // A mistyped address is "not found", not a database error.
    if (!recipeIdSchema.safeParse(id).success) {
      return { status: "not-found" };
    }

    const { data, error } = await supabase
      .from("recipes")
      .select(RECIPE_DETAIL_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Loading the recipe failed", error);
      return { status: "failed" };
    }
    if (!data) {
      return { status: "not-found" };
    }

    const result = recipeDetailRowSchema.safeParse(data);
    if (!result.success) {
      console.error("Unexpected recipe row", result.error);
      return { status: "failed" };
    }
    return { status: "found", recipe: result.data };
  };

  return { recipes: readonly(recipes), loadFailed: readonly(loadFailed), loadList, loadRecipe };
}
