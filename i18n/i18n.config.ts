import { en as vuetifyEn, lt as vuetifyLt } from "vuetify/locale";
import { selectLithuanianPluralForm } from "./pluralRules";

// Runtime options of vue-i18n; the locales and their files are in nuxt.config.ts.
export default defineI18nConfig(() => ({
  // A key missing from Lithuanian shows the English text instead of the key (`npm run i18n:check` refuses it).
  fallbackLocale: "en",
  pluralRules: { lt: selectLithuanianPluralForm },
  // Vuetify's own text (clear buttons, pagination, "Loading…") is read through vue-i18n under `$vuetify`.
  messages: { en: { $vuetify: vuetifyEn }, lt: { $vuetify: vuetifyLt } },
}));
