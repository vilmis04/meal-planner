/*
 * Locale formatting of numbers, dates and lists (X1). Every screen formats through here, so each language reads the
 * same way everywhere; ESLint refuses `new Intl.*Format` and `toLocale*String` anywhere else.
 */

// British English puts the day first, as the designs do ("Mon, 2 Nov").
const LANGUAGE_TAGS: Partial<Record<string, string>> = { en: "en-GB", lt: "lt-LT" };

// Node and browsers ship different ICU data: Node writes "9 – 15 Nov" with thin spaces, Chromium with plain
// ones. The page is rendered on the server and then in the browser, so both must produce the same text.
// Thin space, narrow no-break space and no-break space.
export const ODD_SPACES = new RegExp(`[${String.fromCharCode(0x2009, 0x202f, 0xa0)}]`, "g");

// Lithuanian has no short month names: "short" gives "11-09", so it spells the month out ("lapkričio 9 d.").
const LONG_MONTH_LOCALES = new Set(["lt"]);

export function formatNumber(value: number, locale: string, options: Intl.NumberFormatOptions = {}): string {
  return normaliseSpaces(new Intl.NumberFormat(getFormatLocale(locale), options).format(value));
}

// "Ana, Jonas and you", or "Ana, Jonas ir tu".
export function formatList(items: readonly string[], locale: string): string {
  return new Intl.ListFormat(getFormatLocale(locale), { style: "long", type: "conjunction" }).format(items);
}

// A moment (a timestamp), in the viewer's own time zone unless the options name one.
export function formatDateTime(date: Date, locale: string, options: Intl.DateTimeFormatOptions): string {
  return normaliseSpaces(createDateTimeFormat(locale, options).format(date));
}

// "9 – 15 Nov": Intl leaves out what both ends share.
export function formatDateTimeRange(
  start: Date,
  end: Date,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return normaliseSpaces(createDateTimeFormat(locale, options).formatRange(start, end));
}

// The BCP 47 tag Intl formats a locale code ("en", "lt") with.
const getFormatLocale = (locale: string): string => LANGUAGE_TAGS[locale] ?? locale;

const normaliseSpaces = (text: string): string => text.replace(ODD_SPACES, " ");

const createDateTimeFormat = (locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat(getFormatLocale(locale), withMonth(locale, options));

const withMonth = (locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions =>
  options.month === "short" && LONG_MONTH_LOCALES.has(locale) ? { ...options, month: "long" } : options;
