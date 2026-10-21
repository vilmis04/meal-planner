import type { z } from "zod";
import type { LOCALE_CODES, THEME_PREFERENCES, profileRowSchema } from "~/utils/profile";

export type LocaleCode = (typeof LOCALE_CODES)[number];
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type Profile = z.output<typeof profileRowSchema>;
export type ProfileChanges = Partial<Pick<Profile, "displayName" | "locale" | "theme">>;
