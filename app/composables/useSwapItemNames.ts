import type { SwapItemText } from "#shared/utils/proteinSwap.types";

/*
 * Names of protein swap replacements (D2) in the viewer's language (X1c). A shopping list line made from a replacement
 * that has no canonical ingredient (G1) keeps the Lithuanian item it was built with; the list names it through here,
 * from the swap's stored translations, so a language switch changes it at once. Only the names asked for are read,
 * once each. When they cannot be read, the stored names show.
 */
export function useSwapItemNames() {
  const supabase = useSupabaseClient();
  const { locale } = useI18n();
  const known = useState<Record<string, SwapItemText[]>>("swap-item-names", () => ({}));

  const load = async (names: readonly string[]): Promise<void> => {
    const wanted = [...new Set(names)].filter((name) => !(name in known.value));
    if (wanted.length === 0) {
      return;
    }
    const { data, error } = await supabase.from("recipe_protein_swap_items").select(SWAP_ITEM_NAME_COLUMNS).in("item", wanted);
    if (error) {
      console.error("Loading the swap item names failed", error);
      return;
    }
    const result = swapItemNameRowsSchema.safeParse(data);
    if (!result.success) {
      console.error("Unexpected swap item rows", result.error);
      return;
    }
    // A name no stored swap has (a renamed or removed swap) is remembered too, so it is not asked for again.
    known.value = {
      ...known.value,
      ...Object.fromEntries(wanted.map((name) => [name, result.data.get(name) ?? []])),
    };
  };

  const getSwapItemName = (storedName: string): string =>
    getLocalizedSwapItemName(known.value[storedName], storedName, locale.value);

  return { load, getSwapItemName };
}
