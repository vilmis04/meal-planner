// The design's "Bought last" (G5): whether bought lines go to the bottom of their group. It is on until the viewer
// turns it off, and the choice is remembered for every list in this browser only, like which groups are open. The
// saved choice is read once the page is in the browser, so the server and the first render agree.
const BOUGHT_LAST_STORAGE_KEY = "meal-planner:shopping-list-bought-last";
const BOUGHT_LAST_OFF = "off";

export function useShoppingListBoughtLast() {
  const isBoughtLast = ref(true);

  const setBoughtLast = (isOn: boolean): void => {
    isBoughtLast.value = isOn;
    try {
      if (isOn) {
        localStorage.removeItem(BOUGHT_LAST_STORAGE_KEY);
      } else {
        localStorage.setItem(BOUGHT_LAST_STORAGE_KEY, BOUGHT_LAST_OFF);
      }
    } catch (error) {
      console.warn("Saving the bought last choice failed", error);
    }
  };

  // Storage can be missing or blocked (private windows, blocked site data); bought lines then simply go last.
  onMounted(() => {
    try {
      isBoughtLast.value = localStorage.getItem(BOUGHT_LAST_STORAGE_KEY) !== BOUGHT_LAST_OFF;
    } catch {
      isBoughtLast.value = true;
    }
  });

  return { isBoughtLast: readonly(isBoughtLast), setBoughtLast };
}
