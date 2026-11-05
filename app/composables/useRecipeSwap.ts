import type { Recipe, RecipeProteinSwapResponse, RecipeSwapState } from "~/types/recipe.types";

// A swap generated for the first time takes a few seconds; after this the page stops waiting and says so.
const MAX_WAIT_MS = 30_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/*
 * The protein swap for the signed-in user's diet on one recipe (D3). Recipes the diet allows never ask the
 * server. The request runs in the browser only: the first request for a recipe and diet may wait on the AI,
 * so the page renders without it and the card fills in.
 */
export function useRecipeSwap(recipe: () => Recipe) {
  const { profile } = useProfile();
  const diet = computed(() => profile.value?.diet ?? null);
  const needed = computed(() => swapNeeded(diet.value, recipe().mainProteins));

  // Server render and first client render agree: "loading" when a swap will be asked for, so nothing jumps.
  const state = ref<RecipeSwapState>({ status: needed.value ? "loading" : "none" });
  const showOriginal = ref(false);

  // Each load gets a number; a newer load (another recipe, another diet, leaving the page) retires older ones.
  let run = 0;

  async function load(): Promise<void> {
    const current = ++run;
    showOriginal.value = false;
    const currentDiet = diet.value;
    if (!needed.value || !currentDiet) {
      state.value = { status: "none" };
      return;
    }

    state.value = { status: "loading" };
    const url = `/api/recipes/${recipe().id}/swaps/${currentDiet}`;
    const deadline = Date.now() + MAX_WAIT_MS;

    while (current === run) {
      const response = await $fetch
        .raw<RecipeProteinSwapResponse>(url, { ignoreResponseError: true, retry: 0 })
        .catch((error: unknown) => {
          console.error("Loading the protein swap failed", error);
          return null;
        });
      if (current !== run) return;

      const body = response?._data;
      if (response?.status === 200 && body?.status === "ready") {
        state.value = { status: "ready", swap: body.swap };
        return;
      }
      if (response?.status === 404 && body?.status === "not-needed") {
        state.value = { status: "none" };
        return;
      }
      if (response?.status === 202 && body?.status === "pending") {
        const wait = retryDelayMs(response.headers.get("Retry-After"));
        if (Date.now() + wait > deadline) break;
        await sleep(wait);
        continue;
      }
      // 503 (generation failed, retried later), 429 (too many new swaps) or anything unexpected.
      break;
    }

    if (current === run) {
      state.value = { status: "unavailable" };
    }
  }

  onMounted(load);
  watch([() => recipe().id, diet], load);
  onBeforeUnmount(() => {
    run++;
  });

  return { diet, state: computed(() => state.value), showOriginal };
}
