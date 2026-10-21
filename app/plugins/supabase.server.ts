export default defineNuxtPlugin({
  name: "supabase",
  setup() {
    const event = useRequestEvent();
    useSupabaseUser().value = event?.context.supabaseUser ?? null;

    // The per-request client from server/middleware/supabase.ts, so composables can
    // query Supabase during SSR with the visitor's session.
    return {
      provide: {
        supabase: event?.context.supabase,
      },
    };
  },
});
