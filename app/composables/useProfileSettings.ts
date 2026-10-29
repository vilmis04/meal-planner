import type { Diet } from "#shared/utils/diet";
import type { LocaleCode, ThemePreference } from "~/types/profile.types";

// Settings apply at once and are then saved to the profile when signed in;
// a failed save puts the previous value back so the UI never shows unsaved state.
export function useProfileSettings() {
  const { profile, update } = useProfile();
  const { preference, setPreference } = useAppTheme();
  const { locale, setLocale } = useI18n();

  const changeTheme = async (next: ThemePreference): Promise<boolean> => {
    const previous = preference.value;
    setPreference(next);

    const isSaved = !profile.value || (await update({ theme: next }));
    if (!isSaved) {
      setPreference(previous);
    }
    return isSaved;
  };

  const changeLanguage = async (next: LocaleCode): Promise<boolean> => {
    const previous = locale.value;
    await setLocale(next);

    const isSaved = !profile.value || (await update({ locale: next }));
    if (!isSaved) {
      await setLocale(previous);
    }
    return isSaved;
  };

  const changeDisplayName = (next: string): Promise<boolean> =>
    update({ displayName: next.trim() });

  const changeDiet = (next: Diet): Promise<boolean> => update({ diet: next });

  return { changeTheme, changeLanguage, changeDisplayName, changeDiet };
}
