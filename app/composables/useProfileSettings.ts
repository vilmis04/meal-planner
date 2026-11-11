import type { Diet } from "#shared/utils/diet";
import type { LocaleCode, ThemePreference } from "~/types/profile.types";

// Settings apply at once and are then saved to the profile when signed in;
// a failed save puts the previous value back so the UI never shows unsaved state.
export function useProfileSettings() {
  const { profile, update } = useProfile();
  const { preference, setPreference } = useAppTheme();
  const { locale, setLocale } = useI18n();
  const { hasUnsavedChoice, markUnsaved, clear: clearUnsavedLocale } = useUnsavedLocaleChoice();

  const changeTheme = async (next: ThemePreference): Promise<boolean> => {
    const previous = preference.value;
    setPreference(next);

    const isSaved = !profile.value || (await update({ theme: next }));
    if (!isSaved) {
      setPreference(previous);
    }
    return isSaved;
  };

  // setLocale also writes the `locale` cookie. Signed out, the choice is saved to the profile at the next sign-in.
  const changeLanguage = async (next: LocaleCode): Promise<boolean> => {
    const previous = locale.value;
    await setLocale(next);

    if (!profile.value) {
      markUnsaved();
      return true;
    }

    const isSaved = await update({ locale: next });
    if (!isSaved) {
      await setLocale(previous);
    } else if (hasUnsavedChoice.value) {
      clearUnsavedLocale();
    }
    return isSaved;
  };

  const changeDisplayName = (next: string): Promise<boolean> =>
    update({ displayName: next.trim() });

  const changeDiet = (next: Diet): Promise<boolean> => update({ diet: next });

  return { changeTheme, changeLanguage, changeDisplayName, changeDiet };
}
