import { shoppingListRouteParamsSchema } from "../../../utils/shoppingList.schema";

/*
 * POST /api/plans/:id/shopping-list: brings the plan's shopping list up to date (G2). The list page calls it when it
 * opens; it rebuilds the list only when the plan changed since the last build, and keeps people's changes. No AI is
 * called: a participant whose protein swap is not ready yet gets the original recipe until it is.
 *
 *   200 { status: "up-to-date" } | { status: "refreshed", itemCount, missingSwapCount }
 *   409 { status: "list-changed" }   the plan kept changing meanwhile; the stored list is shown as it is
 *   404                              no such plan, or the user cannot open it
 */
export default defineEventHandler(async (event) => {
  if (!event.context.supabaseUser) {
    throw createError({ statusCode: 401, statusMessage: "Sign in to see a shopping list" });
  }

  const params = shoppingListRouteParamsSchema.safeParse(getRouterParams(event));
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: "Unknown plan" });
  }

  const store = createSupabaseShoppingListStore(event.context.supabase);
  const result = await refreshShoppingList({ store }, { planId: params.data.id });

  switch (result.status) {
    case "not-found":
      throw createError({ statusCode: 404, statusMessage: "Plan not found" });
    case "list-changed":
      setResponseStatus(event, 409);
      return result;
    default:
      return result;
  }
});
