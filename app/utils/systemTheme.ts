export const SYSTEM_THEME_COOKIE = "theme-system";
// The client hint Chromium sends once a response asks for it with Accept-CH (app/plugins/theme.ts).
export const COLOR_SCHEME_HINT_HEADER = "sec-ch-prefers-color-scheme";

const SYSTEM_THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

// The inline <head> script (app/plugins/theme.ts): syncSystemThemeBeforePaint as source text, called on `window`.
export const SYSTEM_THEME_SCRIPT = `(${syncSystemThemeBeforePaint.toString()})(window, ${JSON.stringify(SYSTEM_THEME_COOKIE)}, ${SYSTEM_THEME_COOKIE_MAX_AGE_SECONDS});`;

// Runs in <head>, before the body is parsed: when "system" was rendered as a theme the OS no longer uses (a browser
// that sends no color scheme hint, on its first visit or after the OS setting changed), it remembers the OS theme in
// the cookie and reloads once, hidden, so the wrong theme never paints. Self-contained: it is inlined as source text.
function syncSystemThemeBeforePaint(browser: Window, cookieName: string, maxAgeSeconds: number): void {
  const root = browser.document.documentElement;
  if (root.dataset.themePreference !== "system") {
    return;
  }
  const systemTheme = browser.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const reloadMarkKey = `${cookieName}-reloaded`;
  if (root.dataset.theme === systemTheme) {
    try {
      browser.sessionStorage.removeItem(reloadMarkKey);
    } catch {
      // Storage is blocked; there is no mark to remove.
    }
    return;
  }

  browser.document.cookie = `${cookieName}=${systemTheme}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
  const isCookieSaved = `; ${browser.document.cookie}`.includes(`; ${cookieName}=${systemTheme}`);
  // Without storage a reload could repeat forever, so the theme plugin corrects the theme after hydration instead.
  let hasReloaded = true;
  try {
    hasReloaded = browser.sessionStorage.getItem(reloadMarkKey) === systemTheme;
    browser.sessionStorage.setItem(reloadMarkKey, systemTheme);
  } catch {
    // Storage is blocked; keep hasReloaded.
  }
  if (hasReloaded || !isCookieSaved) {
    return;
  }

  root.style.visibility = "hidden";
  root.style.colorScheme = systemTheme;
  browser.location.reload();
}
