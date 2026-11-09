import type { ShoppingListLoadResult } from "~/types/shoppingList.types";

// A plan's shopping list (G2). The server brings it up to date with the plan; the lines are then read directly, as
// row level security shows the lists of plans the viewer can open only.
export function useShoppingList() {
  const supabase = useSupabaseClient();
  // Forwards the visitor's cookies when the page renders on the server, so the route knows who is asking.
  const requestFetch = useRequestFetch();

  // Resolves to false when the list could not be brought up to date; the stored list is still shown then.
  const refresh = async (planId: string): Promise<boolean> => {
    const response = await requestFetch(`/api/plans/${planId}/shopping-list`, { method: "POST", retry: 0 }).catch(
      (error: unknown) => {
        console.error("Bringing the shopping list up to date failed", error);
        return null;
      },
    );
    return shoppingListRefreshResponseSchema.safeParse(response).success;
  };

  const load = async (planId: string): Promise<ShoppingListLoadResult> => {
    const { data, error } = await supabase
      .from("shopping_lists")
      .select(SHOPPING_LIST_COLUMNS)
      .eq("plan_id", planId)
      .maybeSingle();

    if (error) {
      console.error("Loading the shopping list failed", error);
      return { status: "failed" };
    }
    if (!data) {
      return { status: "not-found" };
    }

    const result = shoppingListRowSchema.safeParse(data);
    if (!result.success) {
      console.error("Unexpected shopping list row", result.error);
      return { status: "failed" };
    }
    return { status: "found", list: result.data };
  };

  return { refresh, load };
}
