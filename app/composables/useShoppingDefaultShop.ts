// The shop the viewer is shopping at (G7, the design's "Shopping at Lidl"): while it is set, ticking a line bought
// records it there without asking. It lasts for this browser tab's session only (sessionStorage), as a trip to the
// shop does, and is read once the page is in the browser, so the server and the first render agree.
const DEFAULT_SHOP_STORAGE_KEY = "meal-planner:shopping-default-shop";

export function useShoppingDefaultShop() {
  const defaultShopName = ref<string | null>(null);

  const setDefaultShopName = (name: string | null): void => {
    defaultShopName.value = name;
    try {
      if (name === null) {
        sessionStorage.removeItem(DEFAULT_SHOP_STORAGE_KEY);
      } else {
        sessionStorage.setItem(DEFAULT_SHOP_STORAGE_KEY, name);
      }
    } catch (error) {
      console.warn("Saving the default shop failed", error);
    }
  };

  // Storage can be missing or blocked (private windows, blocked site data); there is then no default until one is
  // picked, and it lasts while the page is open.
  onMounted(() => {
    try {
      const result = shopNameSchema.safeParse(sessionStorage.getItem(DEFAULT_SHOP_STORAGE_KEY));
      defaultShopName.value = result.success ? result.data : null;
    } catch {
      defaultShopName.value = null;
    }
  });

  return { defaultShopName: readonly(defaultShopName), setDefaultShopName };
}
