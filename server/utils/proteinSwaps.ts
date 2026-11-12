/*
 * The protein swap reader as the Nuxt server uses it: the service-role Supabase client from private runtime config,
 * made once per process. It reads stored swaps only: the server never asks the AI for a swap or its translation
 * (X1c); `npm run swaps:generate` makes them.
 */
import type { H3Event } from "h3";
import { createProteinSwapReader } from "./proteinSwapService";
import type { ProteinSwapReader } from "./proteinSwapService.types";
import { createSupabaseSwapStore } from "./proteinSwapStore";
import { useServiceRoleClient } from "./serviceRoleClient";

let reader: ProteinSwapReader | null = null;

export function useProteinSwapReader(event: H3Event): ProteinSwapReader {
  reader ??= createProteinSwapReader({ store: createSupabaseSwapStore(useServiceRoleClient(event)) });
  return reader;
}
