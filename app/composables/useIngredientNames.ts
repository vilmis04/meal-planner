import type { Page } from "#shared/utils/fetchAllPages";
import type { IngredientNameEntry } from "~/types/ingredientName.types";

/*
 * Names of the canonical ingredients (G1) in the viewer's language (X1b). Shopping list lines and plan adjustment rules
 * keep the Lithuanian name they were made with and their ingredient's id; the screens name them through here, so a
 * line reads "Eggs" in English and follows a switch of language at once. The ingredients are read once, whole (a few
 * hundred short rows), every language at a time. When they cannot be read, every name shows as stored.
 */
export function useIngredientNames() {
  const supabase = useSupabaseClient();
  const { locale } = useI18n();
  const entries = useState<IngredientNameEntry[] | null>("ingredient-names", () => null);

  const fetchPage = async (from: number, to: number): Promise<Page<unknown>> => {
    const { data, error, count } = await supabase
      .from("ingredients")
      .select(INGREDIENT_NAME_COLUMNS, { count: "exact" })
      .order("id")
      .range(from, to);

    if (error) {
      throw error;
    }
    return { rows: data ?? [], total: count };
  };

  // A failure leaves the names unknown, so the next visit asks again; the stored names show meanwhile.
  const load = async (): Promise<void> => {
    if (entries.value !== null) {
      return;
    }
    try {
      const result = ingredientNameRowsSchema.safeParse(await fetchAllPages(fetchPage, INGREDIENT_PAGE_SIZE));
      if (!result.success) {
        console.error("Unexpected ingredient rows", result.error);
        return;
      }
      entries.value = result.data;
    } catch (error) {
      console.error("Loading the ingredient names failed", error);
    }
  };

  const byId = computed(() => new Map((entries.value ?? []).map((entry) => [entry.id, entry])));
  // Lithuanian canonical names are unique, so a name read back from the database finds its ingredient.
  const bySourceName = computed(() => new Map((entries.value ?? []).map((entry) => [entry.sourceName, entry])));

  // The ingredient's name in the viewer's language; the stored name for a line without one (manual, or not mapped).
  const getIngredientName = (ingredientId: string | null, storedName: string): string => {
    const entry = ingredientId === null ? undefined : byId.value.get(ingredientId);
    return entry === undefined ? storedName : getLocalizedIngredientName(entry, locale.value);
  };

  // The same for a name only (shop insights name an item by its ingredient's Lithuanian name).
  const getIngredientNameBySourceName = (storedName: string): string => {
    const entry = bySourceName.value.get(storedName);
    return entry === undefined ? storedName : getLocalizedIngredientName(entry, locale.value);
  };

  return { load, getIngredientName, getIngredientNameBySourceName };
}
