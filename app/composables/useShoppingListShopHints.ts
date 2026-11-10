import type { ShoppingItemShopHint } from "~/types/shoppingList.types";

// Where the lines of a list are usually bought, or were last bought (I1a). get_shopping_list_shop_hints() runs as the
// viewer, so row level security decides which purchases count, as on the list. Hints are a convenience: they are read
// once the page is in the browser, so they never hold up the list or a tick, and when they cannot be read the list
// simply has none. They are read again when the list shows lines they were not read for (a line someone added, or a
// rebuilt list); ticking lines does not change them, as the list's own purchases are left out.
export function useShoppingListShopHints(listId: MaybeRefOrGetter<string | null>, itemIds: MaybeRefOrGetter<readonly string[]>) {
  const supabase = useSupabaseClient();
  const hints = shallowRef<ReadonlyMap<string, ShoppingItemShopHint>>(new Map());
  // The list and lines the last read was for, so a failed read is not repeated until something new shows.
  let readListId: string | null = null;
  let readItemIds: ReadonlySet<string> = new Set();

  const loadHints = createCoalescedRunner(async () => {
    const currentListId = toValue(listId);
    readListId = currentListId;
    readItemIds = new Set(toValue(itemIds));
    if (currentListId === null) {
      hints.value = new Map();
      return;
    }
    const { data, error } = await supabase.rpc("get_shopping_list_shop_hints", { target_list_id: currentListId });
    const result = error ? null : shopHintsSchema.safeParse(data);
    if (!result?.success) {
      console.warn("Loading the shop hints failed", error ?? result?.error);
      return;
    }
    if (toValue(listId) === currentListId) {
      hints.value = result.data;
    }
  });

  onMounted(() => {
    watch(
      () => [toValue(listId), toValue(itemIds)] as const,
      ([currentListId, currentItemIds]) => {
        if (currentListId !== readListId || currentItemIds.some((itemId) => !readItemIds.has(itemId))) {
          loadHints();
        }
      },
      { immediate: true },
    );
  });

  return { hints: readonly(hints) };
}
