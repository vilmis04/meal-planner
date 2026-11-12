import { describe, expect, it } from "vitest";
import { checkLocales, parseMessage } from "./localeCheck";

const check = (en: unknown, lt: unknown, source = ""): string[] =>
  checkLocales({ locales: { en, lt }, sourceFiles: source ? [{ path: "app/page.vue", text: source }] : [] });

describe("parseMessage", () => {
  it("counts plural forms and reads each form's placeholders", () => {
    const parsed = parseMessage("no items | {count} item | {count} items for {name}");
    expect(parsed.formCount).toBe(3);
    expect(parsed.formPlaceholders.map((form) => [...form])).toEqual([[], ["count"], ["count", "name"]]);
    expect(parsed.syntaxErrors).toEqual([]);
  });

  it("reports what vue-i18n cannot compile", () => {
    expect(parseMessage("Hello {name").syntaxErrors).not.toEqual([]);
  });
});

describe("checkLocales", () => {
  it("passes matching locales", () => {
    expect(check({ a: { b: "{count} day | {count} days" } }, { a: { b: "{count} diena | {count} dienos | {count} dienų" } })).toEqual([]);
  });

  it("finds a key missing from one locale", () => {
    expect(check({ a: "A", b: "B" }, { a: "A" })).toEqual(["lt: b is missing"]);
  });

  it("finds empty messages and values that are not text", () => {
    expect(check({ a: "", b: 1 }, { a: "", b: "B" })).toEqual(["en: b is not a string or an object", "en: a is empty", "lt: a is empty", "en: b is missing"]);
  });

  it("finds placeholders that differ, but lets a language leave the number out", () => {
    expect(check({ a: "Hi {name}" }, { a: "Labas {vardas}" })).toEqual(["lt: a has placeholders {vardas}, en has {name}"]);
    expect(check({ a: "once | {count} times" }, { a: "{count} k." })).toEqual([]);
  });

  it("refuses two Lithuanian forms, which its rule cannot tell apart", () => {
    expect(check({ a: "{count} day | {count} days" }, { a: "{count} diena | {count} dienos" })).toEqual([
      "lt: a has 2 plural forms; lt takes 1, 3, 4",
    ]);
  });

  it("asks for the number in the Lithuanian one form, which 21 also uses", () => {
    expect(check({ a: "once | {count} times" }, { a: "kartą | {count} kartus | {count} kartų" })).toEqual([
      'lt: a must show {count} in its "one" form, which is also used for 21, 31 and so on',
    ]);
  });

  it("asks for a zero form in every locale that declines the message", () => {
    expect(check({ a: "none | {count} item | {count} items" }, { a: "{count} prekė | {count} prekės | {count} prekių" })).toEqual([
      "a has a zero form in en only; add it to every locale that declines the message",
    ]);
  });

  it("finds keys in the code that no locale has", () => {
    const locale = { plan: { title: "Plan", kind: { individual: "Mine" } } };
    const source = [
      't("plan.title")',
      "t('plan.kind')",
      "t(`plan.kind.${kind}`)",
      'const key = "plan.missing";',
      "t(`plan.other.${kind}`)",
      '<li :key="plan.id">',
      'import "./plan.vue";',
    ].join("\n");
    expect(check(locale, locale, source)).toEqual([
      "app/page.vue:4: plan.missing is not in the locale files",
      "app/page.vue:5: plan.other… is not in the locale files",
    ]);
  });
});
