// Plan dates are "YYYY-MM-DD" calendar dates. They are formatted in UTC so the day shown is the day stored,
// whatever the viewer's time zone. British English puts the day first, as the designs do ("Mon, 2 Nov").
const LANGUAGE_TAGS: Partial<Record<string, string>> = { en: "en-GB", lt: "lt-LT" };

const toDate = (isoDate: string): Date => new Date(`${isoDate}T00:00:00Z`);
const toTag = (locale: string): string => LANGUAGE_TAGS[locale] ?? locale;

export function formatPlanDay(isoDate: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(toTag(locale), { ...options, timeZone: "UTC" }).format(toDate(isoDate));
}

// "2 – 8 Nov", "27 Oct – 2 Nov" or "28 Dec 2026 – 3 Jan 2027": Intl leaves out what both ends share.
export function formatPlanRange(startDate: string, endDate: string, locale: string): string {
  const format = new Intl.DateTimeFormat(toTag(locale), { day: "numeric", month: "short", timeZone: "UTC" });
  const sameYear = startDate.slice(0, 4) === endDate.slice(0, 4);
  if (sameYear) {
    return format.formatRange(toDate(startDate), toDate(endDate));
  }
  return new Intl.DateTimeFormat(toTag(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .formatRange(toDate(startDate), toDate(endDate));
}
