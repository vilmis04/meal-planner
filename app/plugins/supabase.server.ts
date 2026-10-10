export default defineNuxtPlugin(() => {
  const event = useRequestEvent();
  useSupabaseUser().value = event?.context.supabaseUser ?? null;
});
