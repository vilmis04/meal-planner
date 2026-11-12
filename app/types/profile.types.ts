import type { z } from "zod";
import type { LOCALE_CODES, THEME_PREFERENCES, profileRowSchema } from "~/utils/profile";

export type LocaleCode = (typeof LOCALE_CODES)[number];
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type Profile = z.output<typeof profileRowSchema>;
export type ProfileChanges = Partial<Pick<Profile, "displayName" | "locale" | "theme" | "diet" | "showNutrition">>;

// The language to use once a profile has loaded, and whether the profile must be updated to it.
export interface ProfileLocaleResolution {
  locale: LocaleCode;
  isSaveNeeded: boolean;
}
