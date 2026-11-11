// How the viewer wants the shop hints (I1a): shown on the lines (on until turned off) and whether the list is grouped by
// recommended shop instead of by category (off until turned on). Both are remembered for every list in this browser
// only, like "Bought last" (G5), and read once the page is in the browser, so the server and the first render agree.
const SHOP_HINTS_HIDDEN_STORAGE_KEY = "meal-planner:shopping-list-shop-hints-hidden";
const GROUPED_BY_SHOP_STORAGE_KEY = "meal-planner:shopping-list-grouped-by-shop";
const STORED_ON = "on";

export function useShoppingListShopHintPreferences() {
  const areHintsShown = ref(true);
  const isGroupedByShop = ref(false);

  const setHintsShown = (isShown: boolean): void => {
    areHintsShown.value = isShown;
    saveFlag(SHOP_HINTS_HIDDEN_STORAGE_KEY, !isShown);
  };

  const setGroupedByShop = (isGrouped: boolean): void => {
    isGroupedByShop.value = isGrouped;
    saveFlag(GROUPED_BY_SHOP_STORAGE_KEY, isGrouped);
  };

  // Storage can be missing or blocked (private windows, blocked site data); hints then show and the list is by category.
  onMounted(() => {
    areHintsShown.value = !readFlag(SHOP_HINTS_HIDDEN_STORAGE_KEY);
    isGroupedByShop.value = readFlag(GROUPED_BY_SHOP_STORAGE_KEY);
  });

  return {
    areHintsShown: readonly(areHintsShown),
    isGroupedByShop: readonly(isGroupedByShop),
    setHintsShown,
    setGroupedByShop,
  };
}

// A flag is stored only while it differs from its default.
const saveFlag = (storageKey: string, isOn: boolean): void => {
  try {
    if (isOn) {
      localStorage.setItem(storageKey, STORED_ON);
    } else {
      localStorage.removeItem(storageKey);
    }
  } catch (error) {
    console.warn("Saving the shop hint choice failed", error);
  }
};

const readFlag = (storageKey: string): boolean => {
  try {
    return localStorage.getItem(storageKey) === STORED_ON;
  } catch {
    return false;
  }
};
