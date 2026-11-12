import { formatDateTime, formatDateTimeRange } from "#shared/utils/localeFormat";

// Plan dates are "YYYY-MM-DD" calendar dates. They are formatted in UTC so the day shown is the day stored,
// whatever the viewer's time zone.
const toDate = (isoDate: string): Date => new Date(`${isoDate}T00:00:00Z`);

export function formatPlanDay(isoDate: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  return formatDateTime(toDate(isoDate), locale, { ...options, timeZone: "UTC" });
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
  return formatDateTimeRange(toDate(startDate), toDate(endDate), locale, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}
