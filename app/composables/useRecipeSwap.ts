import type { Recipe, RecipeProteinSwapResponse, RecipeSwapState } from "~/types/recipe.types";

/*
 * The protein swap for the signed-in user's diet on one recipe (D3). Recipes the diet allows never ask the server.
 * The request runs in the browser only, so the page renders without it and the card fills in. The server only reads
 * stored swaps (X1c): a swap not generated yet is "unavailable" at once, with no waiting on an AI.
 *
 * The swap comes with its text in every language it is stored in, and the state shows it in the viewer's language
 * (localizeSwap()), so a switch of language changes it at once without asking again.
 */
export function useRecipeSwap(recipe: () => Recipe) {
  const { profile } = useProfile();
  const { locale } = useI18n();
  const diet = computed(() => profile.value?.diet ?? null);
  const needed = computed(() => swapNeeded(diet.value, recipe().mainProteins));

  // Server render and first client render agree: "loading" when a swap will be asked for, so nothing jumps.
  const loaded = ref<RecipeSwapState>({ status: needed.value ? "loading" : "none" });
  const showOriginal = ref(false);

  // Each load gets a number; a newer load (another recipe, another diet, leaving the page) retires older ones.
  let run = 0;

  async function load(): Promise<void> {
    const current = ++run;
    showOriginal.value = false;
    const currentDiet = diet.value;
    if (!needed.value || !currentDiet) {
      loaded.value = { status: "none" };
      return;
    }

    loaded.value = { status: "loading" };
    const response = await $fetch
      .raw<RecipeProteinSwapResponse>(`/api/recipes/${recipe().id}/swaps/${currentDiet}`, {
        ignoreResponseError: true,
        retry: 0,
      })
      .catch((error: unknown) => {
        console.error("Loading the protein swap failed", error);
        return null;
      });
    if (current !== run) return;

    const body = response?._data;
    if (response?.status === 200 && body?.status === "ready") {
      loaded.value = { status: "ready", swap: body.swap };
    } else if (response?.status === 404 && body?.status === "not-needed") {
      loaded.value = { status: "none" };
    } else {
      // 404 "missing" (not generated yet) or anything unexpected.
      loaded.value = { status: "unavailable" };
    }
  }

  onMounted(load);
  watch([() => recipe().id, diet], load);
  onBeforeUnmount(() => {
    run++;
  });

  const state = computed<RecipeSwapState>(() =>
    loaded.value.status === "ready"
      ? { status: "ready", swap: localizeSwap(loaded.value.swap, recipe().ingredients, locale.value) }
      : loaded.value,
  );

  return { diet, state, showOriginal };
}
