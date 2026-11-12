// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";

// Vuetify props that are shown to the user, on top of the HTML attributes vue/no-bare-strings-in-template checks.
const TRANSLATED_ATTRIBUTES = [
  "title",
  "subtitle",
  "text",
  "label",
  "hint",
  "placeholder",
  "prefix",
  "suffix",
  "messages",
  "error-messages",
  "no-data-text",
  "loading-text",
  "close-text",
  "alt",
  "aria-label",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "aria-description",
];

// Numbers, dates and lists are formatted through shared/utils/localeFormat.ts only (X1).
const LOCALE_FORMAT_RESTRICTIONS = [
  {
    selector:
      "NewExpression[callee.object.name='Intl'][callee.property.name=/^(NumberFormat|DateTimeFormat|ListFormat|PluralRules|RelativeTimeFormat|DisplayNames)$/]",
    message: "Format through shared/utils/localeFormat.ts, so every screen reads the same in each language.",
  },
  {
    selector: "CallExpression[callee.property.name=/^toLocale(String|DateString|TimeString)$/]",
    message: "Format through shared/utils/localeFormat.ts, so every screen reads the same in each language.",
  },
];

export default withNuxt(
  {
    rules: {
      "vue/block-order": ["error", { order: ["script", "template", "style"] }],
      // All UI text comes from i18n/locales (X1): text and user-facing props in templates must be translation keys.
      "vue/no-bare-strings-in-template": [
        "error",
        { attributes: { "/.+/": TRANSLATED_ATTRIBUTES }, directives: ["v-text"] },
      ],
      "no-restricted-syntax": ["error", ...LOCALE_FORMAT_RESTRICTIONS],
    },
  },
  {
    files: ["shared/utils/localeFormat.ts", "i18n/pluralRules.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
);
