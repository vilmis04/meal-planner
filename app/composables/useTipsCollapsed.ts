import type { TipContext } from "~/types/tip.types";

const COLLAPSED = "collapsed";

// Whether the viewer put the tips of a screen out of the way (X3): the plan page's tip card, or the tips section of
// recipes. Tips show until then; the choice is remembered for every plan or recipe in this browser only, as the
// shopping list's "Bought last". The saved choice is read once the page is in the browser, so the server and the first
// render agree.
export function useTipsCollapsed(context: TipContext) {
  const storageKey = `meal-planner:${context}-tips`;
  const isCollapsed = ref(false);

  const setCollapsed = (collapsed: boolean): void => {
    isCollapsed.value = collapsed;
    try {
      if (collapsed) {
        localStorage.setItem(storageKey, COLLAPSED);
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch (error) {
      console.warn("Saving whether tips are shown failed", error);
    }
  };

  // Storage can be missing or blocked (private windows, blocked site data); the tips then simply show.
  onMounted(() => {
    try {
      isCollapsed.value = localStorage.getItem(storageKey) === COLLAPSED;
    } catch {
      isCollapsed.value = false;
    }
  });

  return { isCollapsed: readonly(isCollapsed), setCollapsed };
}
