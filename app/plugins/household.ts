// Forgets the loaded household when the signed-in user changes, so one user's household
// is never shown to the next person who signs in on the same page.
export default defineNuxtPlugin({
  name: "household",
  dependsOn: ["supabase"],
  setup() {
    const user = useSupabaseUser();
    const { clear: clearHousehold } = useHousehold();
    const { clear: clearInvite } = useHouseholdInvite();

    if (import.meta.client) {
      watch(() => user.value?.id, () => {
        clearHousehold();
        clearInvite();
      });
    }
  },
});
