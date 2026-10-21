import { z } from "zod";
import type { ThemePreference } from "~/types/profile.types";

type ResolvedTheme = "light" | "dark";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const themePreferenceSchema = z.enum(THEME_PREFERENCES);
const resolvedThemeSchema = z.enum(["light", "dark"]);

export function useAppTheme() {
  const nuxtApp = useNuxtApp();
  // Vuetify's useTheme() only works inside components; this also runs in plugins.
  const theme = nuxtApp.$vuetify.theme;
  const preferenceCookie = useCookie<string | null>("theme", { maxAge: COOKIE_MAX_AGE_SECONDS });
  // What "system" last resolved to in the browser, for the server render that can't see the OS setting.
  const systemThemeCookie = useCookie<string | null>("theme-system", {
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });

  const preference = computed<ThemePreference>(
    () => themePreferenceSchema.safeParse(preferenceCookie.value).data ?? "system",
  );
  const isDark = computed(() => theme.global.current.value.dark);

  // Vuetify resolves "system" with matchMedia, which the server and the hydrating client
  // can't use without a mismatch, so they render the remembered theme until hydration ends.
  const applyPreference = (next: ThemePreference): void => {
    const isRenderingFromCookies = import.meta.server || nuxtApp.isHydrating;
    theme.global.name.value =
      next === "system" && isRenderingFromCookies ? getRememberedSystemTheme() : next;
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

  const getRememberedSystemTheme = (): ResolvedTheme => {
    return resolvedThemeSchema.safeParse(systemThemeCookie.value).data ?? "light";
  };

  return { preference, isDark, applyPreference, setPreference, rememberSystemTheme };
}
