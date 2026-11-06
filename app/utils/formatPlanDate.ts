// Plan dates are "YYYY-MM-DD" calendar dates. They are formatted in UTC so the day shown is the day stored,
// whatever the viewer's time zone. British English puts the day first, as the designs do ("Mon, 2 Nov").
const LANGUAGE_TAGS: Partial<Record<string, string>> = { en: "en-GB", lt: "lt-LT" };

// Node and browsers ship different ICU data: Node writes "9 – 15 Nov" with thin spaces, Chromium with plain
// ones. The page is rendered on the server and then in the browser, so both must produce the same text.
// Thin space, narrow no-break space and no-break space.
export const ODD_SPACES = new RegExp(`[${String.fromCharCode(0x2009, 0x202f, 0xa0)}]`, "g");

const toDate = (isoDate: string): Date => new Date(`${isoDate}T00:00:00Z`);
const toTag = (locale: string): string => LANGUAGE_TAGS[locale] ?? locale;
const normalise = (text: string): string => text.replace(ODD_SPACES, " ");

export function formatPlanDay(isoDate: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  return normalise(new Intl.DateTimeFormat(toTag(locale), { ...options, timeZone: "UTC" }).format(toDate(isoDate)));
}

// "9 – 15 Nov", "26 Oct – 1 Nov" or "28 Dec 2026 – 3 Jan 2027": Intl leaves out what both ends share.
export function formatPlanRange(startDate: string, endDate: string, locale: string): string {
  const sameYear = startDate.slice(0, 4) === endDate.slice(0, 4);
  const format = new Intl.DateTimeFormat(toTag(locale), {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
  return normalise(format.formatRange(toDate(startDate), toDate(endDate)));
}
