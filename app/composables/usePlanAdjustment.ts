import type { InterpretAdjustmentResult } from "~/types/planAdjustment.types";

/*
 * Adjusting a plan by text (I3). The text goes to the server, which asks the AI for constraints and answers them for
 * the user to confirm; applying them is a plain generation (useMealPlans().generate()). Without an AI key on the
 * server the feature is unavailable and the plan page does not offer it.
 */
export function usePlanAdjustment() {
  // Whether the server can interpret requests. Anything unexpected counts as no, so the page simply leaves it out.
  const loadAvailability = async (): Promise<boolean> => {
    const response = await $fetch("/api/plan-adjustment/availability", { retry: 0 }).catch((error: unknown) => {
      console.error("Checking plan adjustments failed", error);
      return null;
    });
    const body = planAdjustmentAvailabilitySchema.safeParse(response);
    return body.success && body.data.isAvailable;
  };

  const interpret = async (planId: string, text: string): Promise<InterpretAdjustmentResult> => {
    const response = await $fetch
      .raw(`/api/plans/${planId}/adjustment`, { method: "POST", body: { text }, ignoreResponseError: true, retry: 0 })
      .catch((error: unknown) => {
        console.error("Interpreting the adjustment failed", error);
        return null;
      });

    const body = interpretAdjustmentResponseSchema.safeParse(response?._data);
    if (!body.success || body.data.status !== "interpreted") {
      return { isInterpreted: false, errorKey: getAdjustmentErrorKey(response?.status ?? null) };
    }
    return { isInterpreted: true, adjustment: body.data.adjustment };
  };

  return { loadAvailability, interpret };
}
