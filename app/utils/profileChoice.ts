import type { ProfileChoiceResolution } from "~/types/profile.types";

interface ProfileChoiceInput<T> {
  profileValue: T | null;
  activeValue: T;
  hasUnsavedChoice: boolean;
}

// The latest explicit choice wins (X1a, X1d), for the language and the theme alike: a value picked while signed out
// (on the login screen, say) is kept and saved to the profile at sign-in; otherwise the profile's value wins over the
// cookie, so it follows the user to a new device or browser. A profile without a value takes the one in use.
export function resolveProfileChoice<T>({
  profileValue,
  activeValue,
  hasUnsavedChoice,
}: ProfileChoiceInput<T>): ProfileChoiceResolution<T> {
  if (profileValue === null) {
    return { value: activeValue, isSaveNeeded: true };
  }
  if (hasUnsavedChoice) {
    return { value: activeValue, isSaveNeeded: activeValue !== profileValue };
  }
  return { value: profileValue, isSaveNeeded: false };
}
