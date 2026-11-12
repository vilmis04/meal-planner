import type { LocaleCode, ProfileLocaleResolution } from "~/types/profile.types";

interface ProfileLocaleInput {
  profileLocale: LocaleCode | null;
  activeLocale: LocaleCode;
  hasUnsavedChoice: boolean;
}

// The latest explicit choice wins (X1a): a language picked while signed out (on the login screen, say) is kept and
// saved to the profile at sign-in; otherwise the profile's language wins over the cookie, so it follows the user to a
// new device or browser. A new profile has no language yet and takes the one the user is browsing in.
export function resolveProfileLocale({
  profileLocale,
  activeLocale,
  hasUnsavedChoice,
}: ProfileLocaleInput): ProfileLocaleResolution {
  if (profileLocale === null) {
    return { locale: activeLocale, isSaveNeeded: true };
  }
  if (hasUnsavedChoice) {
    return { locale: activeLocale, isSaveNeeded: activeLocale !== profileLocale };
  }
  return { locale: profileLocale, isSaveNeeded: false };
}
