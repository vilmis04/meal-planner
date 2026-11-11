const COOKIE_NAME = "locale-unsaved";

// Remembers that the language was changed while signed out, so signing in saves it to the profile
// instead of the profile's language replacing it. A session cookie: it survives the OAuth redirect
// and the server render after it, but not the end of the browser session.
export function useUnsavedLocaleChoice() {
  const cookie = useCookie<boolean | null>(COOKIE_NAME, { sameSite: "lax" });
  // useCookie refs are not shared within a page, so the profile plugin and the switcher read one state.
  const hasUnsavedChoice = useState(COOKIE_NAME, () => cookie.value === true);

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
