import type { z } from "zod";
import type { LOCALE_CODES, THEME_PREFERENCES, profileRowSchema } from "~/utils/profile";

export type LocaleCode = (typeof LOCALE_CODES)[number];
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type Profile = z.output<typeof profileRowSchema>;
export type ProfileChanges = Partial<Pick<Profile, "displayName" | "locale" | "theme" | "diet" | "showNutrition">>;

// The settings a signed-out choice is kept for at the next sign-in (X1a, X1d).
export type UnsavedProfileSetting = "locale" | "theme";

// The value to use once a profile has loaded, and whether the profile must be updated to it.
export interface ProfileChoiceResolution<T> {
  value: T;
  isSaveNeeded: boolean;
}

// What "system" resolves to: the theme that is actually painted.
export type ResolvedTheme = "light" | "dark";
