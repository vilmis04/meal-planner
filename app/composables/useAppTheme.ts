import { useTheme } from "vuetify";

type ThemeName = "light" | "dark";

export function useAppTheme() {
  const theme = useTheme();
  const themeCookie = useCookie<ThemeName>("theme", { default: () => "light" });

  theme.global.name.value = themeCookie.value;

  function toggleTheme() {
    const next: ThemeName = theme.global.name.value === "dark" ? "light" : "dark";
    theme.global.name.value = next;
    themeCookie.value = next;
  }

  return {
    isDark: computed(() => theme.global.name.value === "dark"),
    toggleTheme,
  };
}
