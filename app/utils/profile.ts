import { z } from "zod";

// Must match i18n.locales in nuxt.config.ts and the profiles_locale_supported constraint.
export const LOCALE_CODES = ["en", "lt"] as const;
// Must match the profiles_theme_supported constraint.
export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
// Must match the profiles_display_name_trimmed_length constraint.
export const DISPLAY_NAME_MAX_LENGTH = 50;

export const PROFILE_COLUMNS = "id, display_name, locale, theme";

export const profileRowSchema = z
  .object({
    id: z.guid(),
    display_name: z.string(),
    locale: z.enum(LOCALE_CODES).nullable(),
    theme: z.enum(THEME_PREFERENCES),
  })
  .transform((row) => ({
    id: row.id,
    displayName: row.display_name,
    locale: row.locale,
    theme: row.theme,
  }));
