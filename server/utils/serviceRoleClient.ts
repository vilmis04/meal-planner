/*
 * The one service-role Supabase client of the Nuxt server, made once per process from private runtime config. It
 * bypasses row level security, so callers check who is asking first. The key never leaves the server.
 */
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { H3Event } from "h3";

let client: SupabaseClient | null = null;

export function useServiceRoleClient(event: H3Event): SupabaseClient {
  if (client) return client;

  const config = useRuntimeConfig(event);
  client = createClient(config.public.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
