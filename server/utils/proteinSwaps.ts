/*
 * The protein swap service as the Nuxt server uses it: the service-role Supabase client and the Gemini client,
 * both from private runtime config, made once per process. The keys never leave the server.
 */
import type { H3Event } from "h3";
import { createGeminiClient } from "./ai/gemini";
import { createProteinSwapService } from "./proteinSwapService";
import type { ProteinSwapService } from "./proteinSwapService.types";
import { createSupabaseSwapStore } from "./proteinSwapStore";
import { useServiceRoleClient } from "./serviceRoleClient";
import { createHourlyLimiter } from "./hourlyLimiter";

let service: ProteinSwapService | null = null;

// Swap requests that would call the AI (cache misses), per user and hour. The pairs that can ever miss are few (one
// per recipe and conflicting diet) anyway.
const SWAP_MISSES_PER_HOUR = 20;

export const allowSwapMiss = createHourlyLimiter(SWAP_MISSES_PER_HOUR);

export function useProteinSwapService(event: H3Event): ProteinSwapService {
  if (service) return service;

  const config = useRuntimeConfig(event);
  service = createProteinSwapService({
    store: createSupabaseSwapStore(useServiceRoleClient(event)),
    ai: () =>
      createGeminiClient({
        apiKey: config.geminiApiKey,
        model: config.geminiModel,
        baseUrl: config.geminiBaseUrl || undefined,
      }),
  });
  return service;
}
