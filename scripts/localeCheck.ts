/*
 * The translation check (X1), run by `npm run i18n:check` and `npm run lint`. It finds what vue-i18n would only show
 * at run time, as a raw key or a wrong form:
 * - a key missing from a locale, an empty message, or a message vue-i18n cannot compile;
 * - placeholders that differ between locales ("{count}" in English, "{n}" in Lithuanian);
 * - plural messages with a number of forms the language's rule (i18n/pluralRules.ts) does not read;
 * - keys written in the code (`t("plan.pageTitle")`, `"household.errors.x"`, `` `recipes.mealType.${type}` ``) that
 *   no locale has.
 */
import { createParser } from "@intlify/message-compiler";
import type { LocaleCheckInput, ParsedMessage, PluralFormRule, SourceFile } from "./localeCheck.types";

export const PLURAL_FORM_RULES: Readonly<Record<string, PluralFormRule>> = {
  // vue-i18n's default rule: "one | other", or "zero | one | other".
  en: { formCounts: [1, 2, 3], zeroFormCount: 3, isOneFormForSeveralNumbers: false },
  // selectLithuanianPluralForm(): "one | few | other", or "zero | one | few | other".
  lt: { formCounts: [1, 3, 4], zeroFormCount: 4, isOneFormForSeveralNumbers: true },
};

// The placeholders vue-i18n fills with the plural number itself.
const COUNT_PLACEHOLDERS = ["count", "n"];

export function checkLocales({ locales, sourceFiles }: LocaleCheckInput): string[] {
  const problems: string[] = [];
  const messagesByLocale = new Map<string, Map<string, string>>();
  for (const [locale, messages] of Object.entries(locales)) {
    const flat = new Map<string, string>();
    flattenMessages(messages, "", flat, (key) => problems.push(`${locale}: ${key} is not a string or an object`));
    messagesByLocale.set(locale, flat);
  }

  const allKeys = new Set([...messagesByLocale.values()].flatMap((messages) => [...messages.keys()]));
  for (const key of [...allKeys].sort()) {
    problems.push(...checkKey(key, messagesByLocale));
  }
  problems.push(...checkSourceKeys(sourceFiles, allKeys));
  return problems;
}

export function parseMessage(message: string): ParsedMessage {
  const syntaxErrors: string[] = [];
  const parser = createParser({ location: false, onError: (error) => syntaxErrors.push(error.message) });
  const { body } = parser.parse(message);
  const forms = "cases" in body ? body.cases : [body];
  const formPlaceholders = forms.map((form) => {
    const placeholders = new Set<string>();
    for (const item of form.items) {
      if ("key" in item && typeof item.key === "string") {
        placeholders.add(item.key);
      }
    }
    return placeholders;
  });
  return { formCount: forms.length, formPlaceholders, syntaxErrors };
}

const checkKey = (key: string, messagesByLocale: ReadonlyMap<string, ReadonlyMap<string, string>>): string[] => {
  const problems: string[] = [];
  const parsedByLocale = new Map<string, ParsedMessage>();
  for (const [locale, messages] of messagesByLocale) {
    const message = messages.get(key);
    if (message === undefined) {
      problems.push(`${locale}: ${key} is missing`);
      continue;
    }
    if (message.trim() === "") {
      problems.push(`${locale}: ${key} is empty`);
      continue;
    }
    const parsed = parseMessage(message);
    if (parsed.syntaxErrors.length) {
      problems.push(`${locale}: ${key} does not compile (${parsed.syntaxErrors.join("; ")})`);
      continue;
    }
    parsedByLocale.set(locale, parsed);
    problems.push(...checkPluralForms(locale, key, parsed));
  }
  problems.push(...comparePlaceholders(key, parsedByLocale));
  problems.push(...compareZeroForms(key, parsedByLocale));
  return problems;
};

const checkPluralForms = (locale: string, key: string, parsed: ParsedMessage): string[] => {
  const rule = PLURAL_FORM_RULES[locale];
  if (!rule) {
    return [`${locale}: no plural rule in scripts/localeCheck.ts`];
  }
  if (!rule.formCounts.includes(parsed.formCount)) {
    return [`${locale}: ${key} has ${parsed.formCount} plural forms; ${locale} takes ${rule.formCounts.join(", ")}`];
  }
  if (!rule.isOneFormForSeveralNumbers || parsed.formCount === 1) {
    return [];
  }
  const oneForm = parsed.formPlaceholders[parsed.formCount === rule.zeroFormCount ? 1 : 0];
  const showsCount = (placeholders: ReadonlySet<string>): boolean =>
    COUNT_PLACEHOLDERS.some((placeholder) => placeholders.has(placeholder));
  if (oneForm && !showsCount(oneForm) && parsed.formPlaceholders.some(showsCount)) {
    return [`${locale}: ${key} must show {count} in its "one" form, which is also used for 21, 31 and so on`];
  }
  return [];
};

const comparePlaceholders = (key: string, parsedByLocale: ReadonlyMap<string, ParsedMessage>): string[] => {
  const placeholdersByLocale = [...parsedByLocale].map(([locale, parsed]) => {
    const placeholders = new Set(parsed.formPlaceholders.flatMap((form) => [...form]));
    // The plural number can be shown in one language and implied in another ("once" against "1 kartą").
    for (const placeholder of COUNT_PLACEHOLDERS) {
      placeholders.delete(placeholder);
    }
    return { locale, placeholders: [...placeholders].sort().join(", ") };
  });
  const [reference] = placeholdersByLocale;
  return placeholdersByLocale
    .filter(({ placeholders }) => reference && placeholders !== reference.placeholders)
    .map(({ locale, placeholders }) =>
      `${locale}: ${key} has placeholders {${placeholders}}, ${reference?.locale} has {${reference?.placeholders}}`,
    );
};

// A zero form ("no items") in one language and not in another would show a number's form for 0 instead.
const compareZeroForms = (key: string, parsedByLocale: ReadonlyMap<string, ParsedMessage>): string[] => {
  const declined = [...parsedByLocale].filter(([, parsed]) => parsed.formCount > 1);
  const withZeroForm = declined.filter(([locale, parsed]) => PLURAL_FORM_RULES[locale]?.zeroFormCount === parsed.formCount);
  if (withZeroForm.length === 0 || withZeroForm.length === declined.length) {
    return [];
  }
  const names = withZeroForm.map(([locale]) => locale).join(", ");
  return [`${key} has a zero form in ${names} only; add it to every locale that declines the message`];
};

const checkSourceKeys = (sourceFiles: readonly SourceFile[], allKeys: ReadonlySet<string>): string[] => {
  const namespaces = new Set([...allKeys].map((key) => key.split(".")[0]));
  const objectKeys = new Set([...allKeys].flatMap(getParentKeys));
  // A quoted key or the start of a template literal key: "plan.pageTitle", 'auth.errors.x', `recipes.mealType.${…}`.
  // Not "./plan.vue", "plan" alone, or a template attribute such as :key="plan.id" (a quote right after "=").
  // The namespace is checked after the match.
  const KEY_LITERAL_REGEX = /(?<!=)(["'`])([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)+)(\.?)(?=["'`]|\$\{)/g;
  const problems: string[] = [];
  for (const { path, text } of sourceFiles) {
    for (const match of text.matchAll(KEY_LITERAL_REGEX)) {
      const [, quote, key = "", trailingDot] = match;
      const end = (match.index ?? 0) + match[0].length;
      const isTemplateHead = quote === "`" && text.startsWith("${", end);
      if (!namespaces.has(key.split(".")[0] ?? "")) {
        continue;
      }
      const isKnown = isTemplateHead ? hasKeyStartingWith(allKeys, `${key}${trailingDot}`) : allKeys.has(key) || objectKeys.has(key);
      if (!isKnown) {
        const line = text.slice(0, match.index).split("\n").length;
        problems.push(`${path}:${line}: ${key}${isTemplateHead ? "…" : ""} is not in the locale files`);
      }
    }
  }
  return problems;
};

// "plan.slot.title" has the parents "plan" and "plan.slot".
const getParentKeys = (key: string): string[] => {
  const parts = key.split(".");
  return parts.slice(1).map((_, index) => parts.slice(0, index + 1).join("."));
};

const hasKeyStartingWith = (keys: ReadonlySet<string>, prefix: string): boolean =>
  [...keys].some((key) => key.startsWith(prefix));

const flattenMessages = (
  value: unknown,
  prefix: string,
  into: Map<string, string>,
  onInvalid: (key: string) => void,
): void => {
  if (typeof value === "string") {
    into.set(prefix, value);
    return;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    onInvalid(prefix);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    flattenMessages(child, prefix ? `${prefix}.${key}` : key, into, onInvalid);
  }
};
