import type { Diet } from "#shared/utils/diet";
import { swapRouteParamsSchema } from "../../../../utils/proteinSwaps.schema";

/*
 * GET /api/recipes/:id/swaps/:diet: the stored protein swap that makes a recipe fit a diet (D2), with its text in
 * every language it is stored in (X1c). Read only: no AI is called here, ever. Swaps and their translations are made
 * once by `npm run swaps:generate`.
 *
 *   200 { status: "ready", swap }      stored, ready and made from the recipe's current ingredients
 *   404 { status: "missing" }          not generated yet (or made from ingredients that changed since): run the script
 *   404 { status: "not-needed" }       the recipe already fits the diet
 */
export default defineEventHandler(async (event) => {
  const user = event.context.supabaseUser;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Sign in to see protein swaps" });
  }

  const params = swapRouteParamsSchema.safeParse(getRouterParams(event));
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: "Unknown recipe or diet" });
  }
  const diet: Diet = params.data.diet;

  const result = await useProteinSwapReader(event).readSwap(params.data.id, diet);

  switch (result.status) {
    case "ready":
      return { status: "ready", swap: result.swap };
    case "missing":
    case "not-needed":
      setResponseStatus(event, 404);
      return { status: result.status };
    case "not-found":
      throw createError({ statusCode: 404, statusMessage: "Recipe not found" });
  }
});
