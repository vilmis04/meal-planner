// Plan dates are "YYYY-MM-DD" calendar dates. They are formatted in UTC so the day shown is the day stored,
// whatever the viewer's time zone. British English puts the day first, as the designs do ("Mon, 2 Nov").
const LANGUAGE_TAGS: Partial<Record<string, string>> = { en: "en-GB", lt: "lt-LT" };

// Node and browsers ship different ICU data: Node writes "9 – 15 Nov" with thin spaces, Chromium with plain
// ones. The page is rendered on the server and then in the browser, so both must produce the same text.
// Thin space, narrow no-break space and no-break space.
export const ODD_SPACES = new RegExp(`[${String.fromCharCode(0x2009, 0x202f, 0xa0)}]`, "g");

// Lithuanian has no short month names: "short" gives "11-09", so it spells the month out ("lapkričio 9 d.").
const LONG_MONTH_LOCALES = new Set(["lt"]);

const toDate = (isoDate: string): Date => new Date(`${isoDate}T00:00:00Z`);
const toTag = (locale: string): string => LANGUAGE_TAGS[locale] ?? locale;
const normalise = (text: string): string => text.replace(ODD_SPACES, " ");
const withMonth = (locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions =>
  options.month === "short" && LONG_MONTH_LOCALES.has(locale) ? { ...options, month: "long" } : options;

export function formatPlanDay(isoDate: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  const format = new Intl.DateTimeFormat(toTag(locale), { ...withMonth(locale, options), timeZone: "UTC" });
  return normalise(format.format(toDate(isoDate)));
}

// "Tue", or "An" in Lithuanian: Intl writes Lithuanian short weekdays in lower case ("an"), but the standard
// abbreviations, and the buttons that start with them, are capitalised.
export function formatShortWeekday(isoDate: string, locale: string): string {
  const name = formatPlanDay(isoDate, locale, { weekday: "short" });
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}

// "9 – 15 Nov", "26 Oct – 1 Nov" or "28 Dec 2026 – 3 Jan 2027": Intl leaves out what both ends share.
export function formatPlanRange(startDate: string, endDate: string, locale: string): string {
  const sameYear = startDate.slice(0, 4) === endDate.slice(0, 4);
  const format = new Intl.DateTimeFormat(toTag(locale), {
    ...withMonth(locale, { day: "numeric", month: "short" }),
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
  return normalise(format.formatRange(toDate(startDate), toDate(endDate)));
}
