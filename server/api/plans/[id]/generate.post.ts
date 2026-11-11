import { randomInt } from "node:crypto";
import { SEED_LIMIT } from "#shared/utils/seededRandom";
import { generateRequestBodySchema, generateRouteParamsSchema } from "../../../utils/planGeneration.schema";

/*
 * POST /api/plans/:id/generate: fills the plan by the generator's rules (E4). No AI is called.
 * Body (optional): { mode, seed, constraints }. mode "fill_empty" (the default) fills the empty slots;
 * "regenerate_unlocked" (E5) replaces every slot that is not locked. seed reproduces a logged generation. constraints
 * are a plan adjustment the user confirmed (I3, POST /api/plans/:id/adjustment interprets the text): the generator
 * applies them as extra rules; no AI is called here either.
 *
 *   200 { status: "generated", filledCount, emptyCount, compromisedCount, seed }
 *   409 { status: "nothing-to-fill" | "all-locked" | "no-participants" | "plan-changed" }
 *   404                                       no such plan, or the user cannot open it
 */
export default defineEventHandler(async (event) => {
  if (!event.context.supabaseUser) {
    throw createError({ statusCode: 401, statusMessage: "Sign in to generate a plan" });
  }

  const params = generateRouteParamsSchema.safeParse(getRouterParams(event));
  const body = generateRequestBodySchema.safeParse(await readBody(event).catch(() => null));
  if (!params.success || !body.success) {
    throw createError({ statusCode: 400, statusMessage: "Unknown plan or invalid request" });
  }

  const store = createSupabasePlanGenerationStore({
    userClient: event.context.supabase,
    serviceClient: useServiceRoleClient(event),
  });
  const result = await generatePlan(
    { store, createSeed: () => randomInt(SEED_LIMIT) },
    { planId: params.data.id, seed: body.data.seed, mode: body.data.mode, constraints: body.data.constraints },
  );

  switch (result.status) {
    case "generated":
      return result;
    case "not-found":
      throw createError({ statusCode: 404, statusMessage: "Plan not found" });
    default:
      setResponseStatus(event, 409);
      return { status: result.status };
  }
});
