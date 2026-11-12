import type { Profile, ProfileChanges } from "~/types/profile.types";

// Keeps the signed-in user's profile loaded and makes its theme and language win over
// the cookies, so settings follow the user to a new device or browser. A theme or language
// chosen while signed out is the exception: it is saved to the profile instead (resolveProfileChoice).
export default defineNuxtPlugin({
  name: "profile",
  dependsOn: ["supabase", "theme"],
  async setup(nuxtApp) {
    const user = useSupabaseUser();
    const { profile, load, update, clear } = useProfile();
    const { clear: clearRatings } = useRecipeRatings();
    const { preference, setPreference } = useAppTheme();
    const unsavedLocale = useUnsavedProfileChoice("locale");
    const unsavedTheme = useUnsavedProfileChoice("theme");
    const i18n = nuxtApp.$i18n;

    const applyProfile = async ({ theme, locale }: Readonly<Profile>): Promise<void> => {
      const themeChoice = resolveProfileChoice({
        profileValue: theme,
        activeValue: preference.value,
        hasUnsavedChoice: unsavedTheme.hasUnsavedChoice.value,
      });
      setPreference(themeChoice.value);

      const localeChoice = resolveProfileChoice({
        profileValue: locale,
        activeValue: i18n.locale.value,
        hasUnsavedChoice: unsavedLocale.hasUnsavedChoice.value,
      });
      if (localeChoice.value !== i18n.locale.value) {
        await i18n.setLocale(localeChoice.value);
      }

      const changes: ProfileChanges = {
        ...(themeChoice.isSaveNeeded && { theme: themeChoice.value }),
        ...(localeChoice.isSaveNeeded && { locale: localeChoice.value }),
      };
      // A failed save keeps the marks, so the next sign-in or page load tries again.
      const isSaved = Object.keys(changes).length === 0 || (await update(changes));
      if (!isSaved) {
        return;
      }
      for (const { hasUnsavedChoice, clear: clearUnsavedChoice } of [unsavedTheme, unsavedLocale]) {
        if (hasUnsavedChoice.value) {
          clearUnsavedChoice();
        }
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
