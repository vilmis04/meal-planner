import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

declare module "h3" {
  interface H3EventContext {
    supabase: SupabaseClient;
    supabaseUser: User | null;
  }
}

export default defineEventHandler(async (event) => {
  const { supabaseUrl, supabaseAnonKey } = useRuntimeConfig(event).public;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return Object.entries(parseCookies(event)).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          setCookie(event, name, value, options);
        }
        for (const [headerName, headerValue] of Object.entries(headers)) {
          setResponseHeader(event, headerName, headerValue);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  event.context.supabase = supabase;
  event.context.supabaseUser = user;
});
