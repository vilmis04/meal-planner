import { randomInt } from "node:crypto";
import { SEED_LIMIT } from "#shared/utils/seededRandom";
import { slotSwapRequestBodySchema, slotSwapRouteParamsSchema } from "../../../../../utils/planGeneration.schema";

/*
 * POST /api/plans/:id/slots/:slotId/swap: replaces one slot's recipe with another the generator's rules allow (E5).
 * The days of a batch are swapped together; every other slot stays as it is. No AI is called.
 * Body (optional): { seed } to reproduce a logged swap.
 *
 *   200 { status: "swapped", filledCount, emptyCount, compromisedCount, seed }
 *   409 { status: "slot-locked" | "no-alternative" | "no-participants" | "plan-changed" }
 *   404                                       no such plan or slot, or the user cannot open the plan
 */
export default defineEventHandler(async (event) => {
  if (!event.context.supabaseUser) {
    throw createError({ statusCode: 401, statusMessage: "Sign in to change a plan" });
  }

  const params = slotSwapRouteParamsSchema.safeParse(getRouterParams(event));
  const body = slotSwapRequestBodySchema.safeParse(await readBody(event).catch(() => null));
  if (!params.success || !body.success) {
    throw createError({ statusCode: 400, statusMessage: "Unknown slot or invalid request" });
  }

  const store = createSupabasePlanGenerationStore({
    userClient: event.context.supabase,
    serviceClient: useServiceRoleClient(event),
  });
  const result = await swapPlanSlot(
    { store, createSeed: () => randomInt(SEED_LIMIT) },
    { planId: params.data.id, slotId: params.data.slotId, seed: body.data.seed },
  );

  switch (result.status) {
    case "swapped":
      return result;
    case "not-found":
      throw createError({ statusCode: 404, statusMessage: "Slot not found" });
    default:
      setResponseStatus(event, 409);
      return { status: result.status };
  }
});
