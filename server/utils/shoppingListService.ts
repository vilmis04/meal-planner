/*
 * Keeps a plan's shopping list in step with the plan (G2). The list is rebuilt only while it is out of date
 * (shopping_lists.generated_version behind source_version, which the database moves whenever the slots, participants,
 * snack options, a participant's diet or a protein swap change). A plan changed while its list was being built
 * refuses the write (list_changed), and the list is built again from what is there now.
 */
import { isRecipeCompatible } from "../../shared/utils/diet";
import type { Diet } from "../../shared/utils/diet";
import { buildShoppingList } from "../../shared/utils/shoppingList";
import type { ShoppingListBuild, ShoppingListParticipant } from "../../shared/utils/shoppingList.types";
import type { RefreshShoppingListResult, ShoppingListServiceDependencies } from "./shoppingListService.types";
import type { ShoppingListStore, StoredShoppingPlan } from "./shoppingListStore.types";

// A plan that changes this many times while its list is built is being edited right now; the next open catches up.
const MAX_ATTEMPTS = 3;

export async function refreshShoppingList(
  { store }: ShoppingListServiceDependencies,
  { planId }: { planId: string },
): Promise<RefreshShoppingListResult> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const plan = await store.loadPlan(planId);
    if (plan === null) {
      return { status: "not-found" };
    }
    if (plan.generatedVersion >= plan.sourceVersion) {
      return { status: "up-to-date" };
    }

    const build = await buildPlanShoppingList(store, plan);
    if ((await store.applyList(planId, plan.sourceVersion, build)) === "applied") {
      return { status: "refreshed", itemCount: build.items.length, missingSwapCount: build.missingSwapCount };
    }
  }
  return { status: "list-changed" };
}

const buildPlanShoppingList = async (store: ShoppingListStore, plan: StoredShoppingPlan): Promise<ShoppingListBuild> => {
  const recipeIds = [...new Set(plan.slots.flatMap((slot) => (slot.recipeId === null ? [] : [slot.recipeId])))];
  if (recipeIds.length === 0 || plan.participantIds.length === 0) {
    return { items: [], missingSwapCount: 0 };
  }

  const [diets, recipes, aliases] = await Promise.all([
    store.loadDiets(plan.participantIds),
    store.loadRecipes(recipeIds),
    store.loadAliases(),
  ]);
  const participants = plan.participantIds.map((userId): ShoppingListParticipant => {
    const diet = diets.get(userId);
    // Guessing "full" would put meat on a vegetarian's list, so an unreadable diet fails the build instead.
    if (diet === undefined) {
      throw new Error(`The diet of participant ${userId} of plan ${plan.id} could not be read`);
    }
    return { userId, diet };
  });

  const recipeList = [...recipes.values()];
  const swapDiets = [...new Set(participants.map((participant) => participant.diet))].filter((diet: Diet) =>
    recipeList.some((recipe) => !isRecipeCompatible(diet, recipe.mainProteins)),
  );
  const swaps = swapDiets.length === 0 ? new Map() : await store.loadSwaps(recipeIds, swapDiets);

  return buildShoppingList({
    slots: plan.slots,
    includeSnacks: plan.includeSnacks,
    snacksOnList: plan.snacksOnList,
    participants,
    recipes,
    swaps,
    aliases,
  });
};
