/*
 * The plan adjustment service (I3) as the Nuxt server uses it: the signed-in user's client for the plan, the
 * service-role client for the cache and the Gemini client, all from private runtime config. The key never leaves the
 * server; without one the feature is off (isPlanAdjustmentAvailable()) and the rest of the app works as before.
 */
import type { H3Event } from "h3";
import { createGeminiClient } from "./ai/gemini";
import { createHourlyLimiter } from "./hourlyLimiter";
import { createPlanAdjustmentService } from "./planAdjustmentService";
import type { PlanAdjustmentService } from "./planAdjustmentService.types";
import { createSupabasePlanAdjustmentStore } from "./planAdjustmentStore";
import { useServiceRoleClient } from "./serviceRoleClient";

// Interpretations that call the AI (cache misses), per user and hour.
const ADJUSTMENT_AI_CALLS_PER_HOUR = 20;

export const allowAdjustmentAiCall = createHourlyLimiter(ADJUSTMENT_AI_CALLS_PER_HOUR);

export function isPlanAdjustmentAvailable(event: H3Event): boolean {
  return Boolean(useRuntimeConfig(event).geminiApiKey);
}

export function usePlanAdjustmentService(event: H3Event): PlanAdjustmentService {
  const config = useRuntimeConfig(event);
  return createPlanAdjustmentService({
    store: createSupabasePlanAdjustmentStore({
      userClient: event.context.supabase,
      serviceClient: useServiceRoleClient(event),
    }),
    ai: () =>
      createGeminiClient({
        apiKey: config.geminiApiKey,
        model: config.geminiModel,
        baseUrl: config.geminiBaseUrl || undefined,
      }),
  });
}
