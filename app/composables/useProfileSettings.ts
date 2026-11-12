import type { Diet } from "#shared/utils/diet";
import type { LocaleCode, ProfileChanges, ThemePreference, UnsavedProfileSetting } from "~/types/profile.types";

// Settings apply at once and are then saved to the profile when signed in;
// a failed save puts the previous value back so the UI never shows unsaved state.
export function useProfileSettings() {
  const { profile, update } = useProfile();
  const { preference, setPreference } = useAppTheme();
  const { locale, setLocale } = useI18n();
  const unsavedChoices: Record<UnsavedProfileSetting, ReturnType<typeof useUnsavedProfileChoice>> = {
    locale: useUnsavedProfileChoice("locale"),
    theme: useUnsavedProfileChoice("theme"),
  };

  // Signed out, the choice is only marked, and the next sign-in saves it to the profile (resolveProfileChoice).
  const saveChoice = async (setting: UnsavedProfileSetting, changes: ProfileChanges): Promise<boolean> => {
    const { hasUnsavedChoice, markUnsaved, clear } = unsavedChoices[setting];
    if (!profile.value) {
      markUnsaved();
      return true;
    }

    const isSaved = await update(changes);
    if (isSaved && hasUnsavedChoice.value) {
      clear();
    }
    return isSaved;
  };

  const changeTheme = async (next: ThemePreference): Promise<boolean> => {
    const previous = preference.value;
    setPreference(next);

    const isSaved = await saveChoice("theme", { theme: next });
    if (!isSaved) {
      setPreference(previous);
    }
    return isSaved;
  };

  // setLocale also writes the `locale` cookie.
  const changeLanguage = async (next: LocaleCode): Promise<boolean> => {
    const previous = locale.value;
    await setLocale(next);

    const isSaved = await saveChoice("locale", { locale: next });
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
