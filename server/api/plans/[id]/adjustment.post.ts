import { adjustmentRequestBodySchema, adjustmentRouteParamsSchema } from "../../../utils/planAdjustment.schema";

/*
 * POST /api/plans/:id/adjustment: interprets a free-text request about the plan ("no fish this week, quick dinners
 * Monday") into constraints with the AI (I3). Nothing is changed: the user confirms the constraints, then
 * POST /api/plans/:id/generate applies them with the rule-based generator.
 * Body: { text } (at most 300 characters).
 *
 *   200 { status: "interpreted", adjustment: { constraints, unsupported } }
 *   503 { status: "unavailable" }             the AI is not configured or could not answer; try again later
 *   429                                       too many new requests from this user
 *   404                                       no such plan, or the user cannot open it
 */
export default defineEventHandler(async (event) => {
  const user = event.context.supabaseUser;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Sign in to adjust a plan" });
  }

  const params = adjustmentRouteParamsSchema.safeParse(getRouterParams(event));
  const body = adjustmentRequestBodySchema.safeParse(await readBody(event).catch(() => null));
  if (!params.success || !body.success) {
    throw createError({ statusCode: 400, statusMessage: "Unknown plan or invalid request" });
  }
  if (!isPlanAdjustmentAvailable(event)) {
    setResponseStatus(event, 503);
    return { status: "unavailable" };
  }

  const result = await usePlanAdjustmentService(event).interpret(params.data.id, body.data.text, {
    allowAiCall: () => allowAdjustmentAiCall(user.id),
  });

  switch (result.status) {
    case "interpreted":
      return result;
    case "not-found":
      throw createError({ statusCode: 404, statusMessage: "Plan not found" });
    case "limited":
      throw createError({ statusCode: 429, statusMessage: "Too many adjustment requests; try again later" });
    case "unavailable":
      setResponseStatus(event, 503);
      return { status: "unavailable" };
  }
});
