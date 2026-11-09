import type { ShoppingListGroupKey } from "#shared/utils/shoppingList.types";
import type { StoredGroupExpansion } from "~/types/shoppingList.types";

// Which groups of a shopping list are open (G3). Every group starts open; what the viewer opens or closes is
// remembered per list in this browser, so a group done in the shop stays closed after leaving the page. The saved
// state is read once the page is in the browser, so the server and the first render agree.
export function useShoppingListGroupExpansion(listId: MaybeRefOrGetter<string | null>) {
  // Only the groups this viewer changed on this list.
  const changedGroups = ref<Readonly<Record<string, boolean>>>({});

  const isGroupExpanded = (groupKey: ShoppingListGroupKey): boolean => changedGroups.value[groupKey] ?? true;

  const setGroupExpanded = (groupKey: ShoppingListGroupKey, isExpanded: boolean): void => {
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
