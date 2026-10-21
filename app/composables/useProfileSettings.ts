import type { LocaleCode, ThemePreference } from "~/types/profile.types";

// Settings apply at once and are then saved to the profile when signed in;
// a failed save puts the previous value back so the UI never shows unsaved state.
export function useProfileSettings() {
  const { profile, update } = useProfile();
  const { preference, setPreference } = useAppTheme();
  const { locale, setLocale } = useI18n();

  async function changeTheme(next: ThemePreference): Promise<boolean> {
    const previous = preference.value;
    setPreference(next);

    const isSaved = !profile.value || (await update({ theme: next }));
    if (!isSaved) {
      setPreference(previous);
    }
    return isSaved;
  }

  async function changeLanguage(next: LocaleCode): Promise<boolean> {
    const previous = locale.value;
    await setLocale(next);

    const isSaved = !profile.value || (await update({ locale: next }));
    if (!isSaved) {
      await setLocale(previous);
    }
    return isSaved;
  }

  function changeDisplayName(next: string): Promise<boolean> {
    return update({ displayName: next.trim() });
  }

  return { changeTheme, changeLanguage, changeDisplayName };
}
