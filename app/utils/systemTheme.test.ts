import { describe, expect, it, vi } from "vitest";
import { SYSTEM_THEME_SCRIPT } from "./systemTheme";

interface FakeBrowserOptions {
  preference: string;
  rendered: string;
  isSystemDark: boolean;
  reloadMark?: string;
  isCookieBlocked?: boolean;
}

// Runs the inlined source text itself, so a build that changes the function's text would show up here.
const runScript = ({ preference, rendered, isSystemDark, reloadMark, isCookieBlocked = false }: FakeBrowserOptions) => {
  const storage = new Map<string, string>(reloadMark ? [["theme-system-reloaded", reloadMark]] : []);
  let cookies = "locale=en";
  const browser = {
    document: {
      documentElement: { dataset: { themePreference: preference, theme: rendered }, style: {} as Record<string, string> },
      get cookie() {
        return cookies;
      },
      set cookie(value: string) {
        if (!isCookieBlocked) {
          cookies = `${cookies}; ${value.split(";")[0]}`;
        }
      },
    },
    matchMedia: () => ({ matches: isSystemDark }),
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    location: { reload: vi.fn() },
  };
  new Function("window", SYSTEM_THEME_SCRIPT)(browser);
  return { browser, storage, cookies };
};

describe("SYSTEM_THEME_SCRIPT", () => {
  it("does nothing for an explicit theme", () => {
    const { browser, cookies } = runScript({ preference: "light", rendered: "light", isSystemDark: true });
    expect(browser.location.reload).not.toHaveBeenCalled();
    expect(cookies).toBe("locale=en");
  });

  it("does nothing when the rendered theme is the OS theme, and forgets an earlier reload", () => {
    const { browser, storage } = runScript({ preference: "system", rendered: "dark", isSystemDark: true, reloadMark: "dark" });
    expect(browser.location.reload).not.toHaveBeenCalled();
    expect(storage.size).toBe(0);
  });

  it("remembers the OS theme and reloads, hidden, when the render guessed wrong", () => {
    const { browser, cookies } = runScript({ preference: "system", rendered: "light", isSystemDark: true });
    expect(cookies).toBe("locale=en; theme-system=dark");
    expect(browser.location.reload).toHaveBeenCalledOnce();
    expect(browser.document.documentElement.style).toEqual({ visibility: "hidden", colorScheme: "dark" });
  });

  it("reloads only once for the same OS theme", () => {
    const { browser } = runScript({ preference: "system", rendered: "light", isSystemDark: true, reloadMark: "dark" });
    expect(browser.location.reload).not.toHaveBeenCalled();
  });

  it("does not reload when the cookie cannot be saved", () => {
    const { browser } = runScript({ preference: "system", rendered: "dark", isSystemDark: false, isCookieBlocked: true });
    expect(browser.location.reload).not.toHaveBeenCalled();
  });
});
