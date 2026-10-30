import type { Page } from "#shared/utils/fetchAllPages";

// The newest tap on each recipe, so a save that fails late cannot undo a tap made after it.
const latestTap = new Map<string, number>();
let tapCount = 0;

// The signed-in user's own ratings (C3), keyed by recipe id. A recipe with no entry is unrated.
export function useRecipeRatings() {
  const supabase = useSupabaseClient();
  const user = useSupabaseUser();
  const ratings = useState<Record<string, RecipeRating> | null>("recipe-ratings", () => null);
  const loadFailed = useState<boolean>("recipe-ratings-load-failed", () => false);

  const fetchPage = async (from: number, to: number): Promise<Page<unknown>> => {
    const { data, error, count } = await supabase
      .from("user_recipe_preferences")
      .select(RECIPE_RATING_COLUMNS, { count: "exact" })
      // The recipe id breaks ties, so a row can never fall between two pages. Row level security
      // already limits the rows to the signed-in user's.
      .order("recipe_id")
      .range(from, to);

    if (error) {
      throw error;
    }
    return { rows: data ?? [], total: count };
  };

  // Leaves the ratings unknown on failure, so the page hides the controls instead of showing "unrated" falsely.
  const load = async (): Promise<void> => {
    let result: ReturnType<typeof recipeRatingRowsSchema.safeParse> | null = null;
    let failure: unknown = null;
    try {
      result = recipeRatingRowsSchema.safeParse(await fetchAllPages(fetchPage, RECIPE_RATING_PAGE_SIZE));
    } catch (error) {
      failure = error;
    }

    if (!result?.success) {
      console.error("Loading the ratings failed", failure ?? result?.error);
      ratings.value = null;
      loadFailed.value = true;
      return;
    }

    ratings.value = result.data;
    loadFailed.value = false;
  };

  // False until the ratings have arrived, and after a failed load: the controls stay hidden then.
  const isLoaded = computed(() => ratings.value !== null);

  const ratingOf = (recipeId: string): RecipeRating | null => ratings.value?.[recipeId] ?? null;

  const apply = (recipeId: string, rating: RecipeRating | null): void => {
    const { [recipeId]: _previous, ...others } = ratings.value ?? {};
    ratings.value = rating === null ? others : { ...others, [recipeId]: rating };
  };

  // The screen follows the tap at once. Resolves to false when nothing was saved, and then the previous rating
  // is put back unless the recipe was tapped again in the meantime.
  const rate = async (recipeId: string, rating: RecipeRating | null): Promise<boolean> => {
    const userId = user.value?.id;
    if (!ratings.value || !userId) {
      return false;
    }

    const previous = ratingOf(recipeId);
    const tap = ++tapCount;
    latestTap.set(recipeId, tap);
    apply(recipeId, rating);

    const { error } =
      rating === null
        ? await supabase.from("user_recipe_preferences").delete().eq("user_id", userId).eq("recipe_id", recipeId)
        : await supabase
            .from("user_recipe_preferences")
            .upsert({ user_id: userId, recipe_id: recipeId, rating }, { onConflict: "user_id,recipe_id" });

    if (!error) {
      return true;
    }

    console.error("Saving the rating failed", error);
    if (latestTap.get(recipeId) === tap) {
      apply(recipeId, previous);
    }
    return false;
  };

  const clear = (): void => {
    ratings.value = null;
    loadFailed.value = false;
    latestTap.clear();
  };

  return { isLoaded, loadFailed: readonly(loadFailed), load, ratingOf, rate, clear };
}
