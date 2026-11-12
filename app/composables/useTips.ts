import { getIngredientTips, getPlanTips, getRecipeTips } from "#shared/utils/tips";
import type { ShownTip, TipEntry, TipIngredientEntry } from "~/types/tip.types";

// One read for every screen showing tips at once (the plan page, its list pane and the picker's recipe preview).
// Tips are read in the browser only, so this never outlives a page view on the server.
let pendingLoad: Promise<void> | null = null;

/*
 * Tips in context (X3): the tips a plan, a recipe or a shopping list line shows, in the viewer's language. The tips
 * and the ingredients they are about are read once, in the browser after the page is up (tips never hold a page
 * back), every language at a time, so a language switch shows them in the other language at once (X1b). Which tip goes
 * where is decided by shared/utils/tips.ts. When they cannot be read, no tips are shown.
 */
export function useTips() {
  const supabase = useSupabaseClient();
  const { locale } = useI18n();
  const tips = useState<TipEntry[] | null>("tips", () => null);
  const ingredients = useState<TipIngredientEntry[] | null>("tip-ingredients", () => null);

  const read = async (): Promise<void> => {
    const [tipResult, ingredientResult] = await Promise.all([
      supabase.from("tips").select(TIP_COLUMNS).order("created_at").order("id"),
      supabase.from("ingredients").select(TIP_INGREDIENT_COLUMNS).not("tip_tags", "eq", "{}").order("id"),
    ]);
    if (tipResult.error || ingredientResult.error) {
      console.error("Loading the tips failed", tipResult.error ?? ingredientResult.error);
      return;
    }
    const parsedTips = tipRowsSchema.safeParse(tipResult.data);
    const parsedIngredients = tipIngredientRowsSchema.safeParse(ingredientResult.data);
    if (!parsedTips.success || !parsedIngredients.success) {
      console.error("Unexpected tip rows", parsedTips.error ?? parsedIngredients.error);
      return;
    }
    tips.value = parsedTips.data;
    ingredients.value = parsedIngredients.data;
  };

  // A failure leaves the tips unknown, so the next screen asks again.
  const load = async (): Promise<void> => {
    if (tips.value !== null) {
      return;
    }
    pendingLoad ??= read()
      .catch((error: unknown) => console.error("Loading the tips failed", error))
      .finally(() => {
        pendingLoad = null;
      });
    await pendingLoad;
  };

  onMounted(() => {
    void load();
  });

  const ingredientById = computed(() => new Map((ingredients.value ?? []).map((entry) => [entry.id, entry])));

  const toShownTip = (tip: TipEntry, aboutIds: readonly string[] = []): ShownTip => ({
    id: tip.id,
    text: getLocalizedTipText(tip, locale.value),
    about: aboutIds.flatMap((id) => {
      const ingredient = ingredientById.value.get(id);
      return ingredient === undefined ? [] : [getLocalizedTipIngredientName(ingredient, locale.value)];
    }),
  });

  // A shopping list line's tips: its ingredient's (none for a manual line or one without an ingredient).
  const getShoppingItemTips = (ingredientId: string | null): ShownTip[] => {
    const ingredient = ingredientId === null ? undefined : ingredientById.value.get(ingredientId);
    return ingredient === undefined ? [] : getIngredientTips(tips.value ?? [], ingredient.tipTags).map((tip) => toShownTip(tip));
  };

  // A recipe's tips, given the Lithuanian items of its lines, each with the ingredients it is about.
  const getRecipeTipList = (items: readonly string[]): ShownTip[] =>
    getRecipeTips(tips.value ?? [], ingredients.value ?? [], items).map((match) =>
      toShownTip(match.tip, match.ingredientIds),
    );

  // The plan page's tips for a plan with this many people.
  const getPlanTipList = (participantCount: number): ShownTip[] =>
    getPlanTips(tips.value ?? [], participantCount).map((tip) => toShownTip(tip));

  return { getShoppingItemTips, getRecipeTipList, getPlanTipList };
}
