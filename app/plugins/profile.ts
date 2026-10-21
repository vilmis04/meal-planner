import type { Profile } from "~/types/profile.types";

// Keeps the signed-in user's profile loaded and makes its theme and language win over
// the cookies, so settings follow the user to a new device or browser.
export default defineNuxtPlugin({
  name: "profile",
  dependsOn: ["supabase", "theme"],
  async setup(nuxtApp) {
    const user = useSupabaseUser();
    const { profile, load, update, clear } = useProfile();
    const { setPreference } = useAppTheme();
    const i18n = nuxtApp.$i18n;

    const applyProfile = async ({ theme, locale }: Readonly<Profile>): Promise<void> => {
      setPreference(theme);

      // A new profile has no language yet: keep the one the user is browsing in.
      if (locale === null) {
        await update({ locale: i18n.locale.value });
      } else if (locale !== i18n.locale.value) {
        await i18n.setLocale(locale);
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
      watch(() => user.value?.id, syncWithUser);
    }
  },
});
