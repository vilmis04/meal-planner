import type { RecipeLoadResult, RecipeSummary } from "~/types/recipe.types";
import type { Page } from "#shared/utils/fetchAllPages";

export function useRecipes() {
  const supabase = useSupabaseClient();
  // The library is loaded once, whole, and filtered in the browser: a row is about 90 bytes, so a few thousand
  // recipes are still a small payload. It is read page by page because Supabase caps a response at 1000 rows
  // (silently), so a long library is never cut off. If it ever outgrows what one list can show, filtering and
  // paging move to the server (the meal_type column is already indexed).
  const recipes = useState<RecipeSummary[] | null>("recipes", () => null);
  const loadFailed = useState<boolean>("recipes-load-failed", () => false);

  const fetchPage = async (from: number, to: number): Promise<Page<unknown>> => {
    const { data, error, count } = await supabase
      .from("recipes")
      .select(RECIPE_LIST_COLUMNS, { count: "exact" })
      // The id breaks ties, so a row can never fall between two pages.
      .order("name")
      .order("id")
      .range(from, to);

    if (error) {
      throw error;
    }
    return { rows: data ?? [], total: count };
  };

  // Leaves the list empty on failure so the page can show an error and try again on the next visit.
  const loadList = async (): Promise<void> => {
    let result: ReturnType<typeof recipeListRowsSchema.safeParse> | null = null;
    let failure: unknown = null;
    try {
      result = recipeListRowsSchema.safeParse(await fetchAllPages(fetchPage, RECIPE_PAGE_SIZE));
    } catch (error) {
      failure = error;
    }

    if (!result?.success) {
      console.error("Loading the recipes failed", failure ?? result?.error);
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
