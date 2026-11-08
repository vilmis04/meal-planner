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
import { createSwapMissLimiter } from "./swapMissLimiter";

let service: ProteinSwapService | null = null;

export const allowSwapMiss = createSwapMissLimiter();

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
