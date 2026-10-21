import { createBrowserClient } from "@supabase/ssr";

export default defineNuxtPlugin({
  name: "supabase",
  setup() {
    const { supabaseUrl, supabaseAnonKey } = useRuntimeConfig().public;

    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

    // Keeps client-side route middleware (which reads useSupabaseUser()) in
    // sync after sign-in/sign-out, since those don't trigger a full SSR reload.
    const user = useSupabaseUser();
    supabase.auth.onAuthStateChange((_event, session) => {
      user.value = session?.user ?? null;
    });

    return {
      provide: {
        supabase,
      },
    };
  },
});
