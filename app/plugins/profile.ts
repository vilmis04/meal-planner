import type { Profile } from "~/types/profile.types";

// Keeps the signed-in user's profile loaded and makes its theme and language win over
// the cookies, so settings follow the user to a new device or browser. A language chosen
// while signed out is the exception: it is saved to the profile instead (resolveProfileLocale).
export default defineNuxtPlugin({
  name: "profile",
  dependsOn: ["supabase", "theme"],
  async setup(nuxtApp) {
    const user = useSupabaseUser();
    const { profile, load, update, clear } = useProfile();
    const { clear: clearRatings } = useRecipeRatings();
    const { setPreference } = useAppTheme();
    const { hasUnsavedChoice, clear: clearUnsavedLocale } = useUnsavedLocaleChoice();
    const i18n = nuxtApp.$i18n;

    const applyProfile = async ({ theme, locale }: Readonly<Profile>): Promise<void> => {
      setPreference(theme);

      const { locale: nextLocale, isSaveNeeded } = resolveProfileLocale({
        profileLocale: locale,
        activeLocale: i18n.locale.value,
        hasUnsavedChoice: hasUnsavedChoice.value,
      });
      if (nextLocale !== i18n.locale.value) {
        await i18n.setLocale(nextLocale);
      }
      // A failed save keeps the mark, so the next sign-in or page load tries again.
      const isSaved = !isSaveNeeded || (await update({ locale: nextLocale }));
      if (isSaved && hasUnsavedChoice.value) {
        clearUnsavedLocale();
      }
    };

    const syncWithUser = async (userId: string | undefined): Promise<void> => {
      if (!userId) {
        clear();
        return;
      }
      // After SSR the profile arrives in the payload, so the client doesn't fetch it again.
      if (profile.value?.id !== userId) {
        await load(userId);
      }
      if (profile.value) {
        await applyProfile(profile.value);
      }
    };

    await syncWithUser(user.value?.id);

    if (import.meta.client) {
      watch(() => user.value?.id, (userId) => {
        // Ratings are private to one user: the next account must never see the previous one's.
        clearRatings();
        return syncWithUser(userId);
      });
    }
  },
});
