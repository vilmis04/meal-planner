import type { ShoppingListPageGroupKey, StoredGroupExpansion } from "~/types/shoppingList.types";

// Groups that start closed: what is at home is out of the way until someone looks (G4).
const CLOSED_BY_DEFAULT: ReadonlySet<ShoppingListPageGroupKey> = new Set([HAVE_AT_HOME_GROUP_KEY]);

// Which groups of a shopping list are open (G3). Groups start open, except "Have at home"; what the viewer opens or
// closes is remembered per list in this browser, so a group done in the shop stays closed after leaving the page.
// The saved state is read once the page is in the browser, so the server and the first render agree.
export function useShoppingListGroupExpansion(listId: MaybeRefOrGetter<string | null>) {
  // Only the groups this viewer changed on this list.
  const changedGroups = ref<Readonly<Record<string, boolean>>>({});

  const isGroupExpanded = (groupKey: ShoppingListPageGroupKey): boolean =>
    changedGroups.value[groupKey] ?? !CLOSED_BY_DEFAULT.has(groupKey);

  const setGroupExpanded = (groupKey: ShoppingListPageGroupKey, isExpanded: boolean): void => {
    changedGroups.value = { ...changedGroups.value, [groupKey]: isExpanded };
    const currentListId = toValue(listId);
    if (currentListId === null) {
      return;
    }
    try {
      const updated = setStoredGroupExpansion(readStored(), currentListId, groupKey, isExpanded);
      localStorage.setItem(GROUP_EXPANSION_STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.warn("Saving which shopping list groups are open failed", error);
    }
  };

  onMounted(() => {
    watch(
      () => toValue(listId),
      (currentListId) => {
        changedGroups.value = currentListId === null ? {} : (readStored()[currentListId] ?? {});
      },
      { immediate: true },
    );
  });

  return { isGroupExpanded, setGroupExpanded };
}

// Storage can be missing or blocked (private windows, blocked site data); the groups then simply start open.
const readStored = (): StoredGroupExpansion => {
  try {
    return parseStoredGroupExpansion(localStorage.getItem(GROUP_EXPANSION_STORAGE_KEY));
  } catch {
    return {};
  }
};
