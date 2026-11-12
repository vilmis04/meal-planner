import type { UnsavedProfileSetting } from "~/types/profile.types";

// Remembers that a setting (the language or the theme) was changed while signed out, so signing in saves it to the
// profile instead of the profile's value replacing it. A session cookie (`locale-unsaved`, `theme-unsaved`): it
// survives the OAuth redirect and the server render after it, but not the end of the browser session.
export function useUnsavedProfileChoice(setting: UnsavedProfileSetting) {
  const cookieName = `${setting}-unsaved`;
  const cookie = useCookie<boolean | null>(cookieName, { sameSite: "lax" });
  // useCookie refs are not shared within a page, so the profile plugin and the switchers read one state.
  const hasUnsavedChoice = useState(cookieName, () => cookie.value === true);

  const markUnsaved = (): void => {
    hasUnsavedChoice.value = true;
    cookie.value = true;
  };

  const clear = (): void => {
    hasUnsavedChoice.value = false;
    cookie.value = null;
  };

  return { hasUnsavedChoice: readonly(hasUnsavedChoice), markUnsaved, clear };
}
