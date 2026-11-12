import { z } from "zod";
import type { ResolvedTheme, ThemePreference } from "~/types/profile.types";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const themePreferenceSchema = z.enum(THEME_PREFERENCES);
const resolvedThemeSchema = z.enum(["light", "dark"]);

export function useAppTheme() {
  const nuxtApp = useNuxtApp();
  // Vuetify's useTheme() only works inside components; this also runs in plugins.
  const theme = nuxtApp.$vuetify.theme;
  const preferenceCookie = useCookie<string | null>("theme", { maxAge: COOKIE_MAX_AGE_SECONDS });
  // What "system" last resolved to in the browser, for the server render that can't see the OS setting.
  const systemThemeCookie = useCookie<string | null>(SYSTEM_THEME_COOKIE, { maxAge: COOKIE_MAX_AGE_SECONDS });
  // What the server rendered "system" as, from the browser's color scheme hint when it sends one (Chromium does,
  // see app/plugins/theme.ts), else the remembered cookie. The payload carries it, so hydration renders the same.
  const renderedSystemTheme = useState<ResolvedTheme>(
    "theme-system-rendered",
    () =>
      parseColorSchemeHint(useRequestHeader(COLOR_SCHEME_HINT_HEADER)) ??
      resolvedThemeSchema.safeParse(systemThemeCookie.value).data ??
      "light",
  );

  const preference = computed<ThemePreference>(
    () => themePreferenceSchema.safeParse(preferenceCookie.value).data ?? "system",
  );
  const isDark = computed(() => theme.global.current.value.dark);

  // Vuetify resolves "system" with matchMedia, which the server and the hydrating client
  // can't use without a mismatch, so they render what the server resolved until hydration ends.
  const applyPreference = (next: ThemePreference): void => {
    const isRenderingFromCookies = import.meta.server || nuxtApp.isHydrating;
    theme.global.name.value = next === "system" && isRenderingFromCookies ? renderedSystemTheme.value : next;
  };

  const setPreference = (next: ThemePreference): void => {
    preferenceCookie.value = next;
    applyPreference(next);
  };

  const rememberSystemTheme = (): void => {
    if (theme.isSystem.value) {
      systemThemeCookie.value = theme.global.name.value;
    }
  };

  return { preference, isDark, applyPreference, setPreference, rememberSystemTheme };
}

// Sec-CH-Prefers-Color-Scheme is a structured header string: `"dark"` or `"light"`, quotes included.
function parseColorSchemeHint(header: string | null | undefined): ResolvedTheme | null {
  return resolvedThemeSchema.safeParse(header?.replaceAll('"', "")).data ?? null;
}
