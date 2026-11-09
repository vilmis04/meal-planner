import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN_SCHEDULE, getDateInTimeZone, getScheduleParticipantIds, getScheduleRun } from "./planSchedule";

describe("DEFAULT_PLAN_SCHEDULE", () => {
  // Written out on purpose: these are the column defaults of plan_schedules.
  it("matches the database defaults", () => {
    expect(DEFAULT_PLAN_SCHEDULE).toEqual({
      isEnabled: false,
      createWeekday: 6,
      startWeekday: 1,
      dayCount: 7,
      snacksOnList: true,
      participantIds: null,
    });
  });
});

describe("getScheduleRun", () => {
  const saturdayForMonday = { createWeekday: 6, startWeekday: 1, dayCount: 7 };

  it("makes the design's plan: on Saturday 25 Oct for 27 Oct to 2 Nov", () => {
    expect(getScheduleRun(saturdayForMonday, "2025-10-20")).toEqual({
      runDate: "2025-10-25",
      startDate: "2025-10-27",
      endDate: "2025-11-02",
    });
  });

  it("runs today when today is the weekday", () => {
    expect(getScheduleRun(saturdayForMonday, "2025-10-25").runDate).toBe("2025-10-25");
  });

  it("runs next week from the day after", () => {
    expect(getScheduleRun(saturdayForMonday, "2025-10-26")).toEqual({
      runDate: "2025-11-01",
      startDate: "2025-11-03",
      endDate: "2025-11-09",
    });
  });

  it("starts a week later when the plan starts on the run's weekday", () => {
    expect(getScheduleRun({ createWeekday: 1, startWeekday: 1, dayCount: 7 }, "2026-11-09")).toEqual({
      runDate: "2026-11-09",
      startDate: "2026-11-16",
      endDate: "2026-11-22",
    });
  });

  it("starts the next day when that is the start weekday", () => {
    expect(getScheduleRun({ createWeekday: 7, startWeekday: 1, dayCount: 14 }, "2026-11-09")).toEqual({
      runDate: "2026-11-15",
      startDate: "2026-11-16",
      endDate: "2026-11-29",
    });
  });

  it("can start on a weekday before the run's, in the following week", () => {
    expect(getScheduleRun({ createWeekday: 5, startWeekday: 2, dayCount: 1 }, "2026-11-09")).toEqual({
      runDate: "2026-11-13",
      startDate: "2026-11-17",
      endDate: "2026-11-17",
    });
  });

  it("crosses months and years by the calendar", () => {
    expect(getScheduleRun(saturdayForMonday, "2026-12-30")).toEqual({
      runDate: "2027-01-02",
      startDate: "2027-01-04",
      endDate: "2027-01-10",
    });
  });
});

describe("getScheduleParticipantIds", () => {
  const memberIds = ["ana", "monika", "petras"];

  it("stores everyone as null, so newcomers join too", () => {
    expect(getScheduleParticipantIds(["petras", "ana", "monika"], memberIds)).toBeNull();
  });

  it("keeps the ticked members in the household's order", () => {
    expect(getScheduleParticipantIds(["petras", "ana"], memberIds)).toEqual(["ana", "petras"]);
  });

  it("ignores someone who is no longer a member", () => {
    expect(getScheduleParticipantIds(["monika", "ola"], memberIds)).toEqual(["monika"]);
  });
});

describe("getDateInTimeZone", () => {
  // 22:30 UTC on Friday 13 Nov 2026: already Saturday in Vilnius, still Friday in New York.
  const lateFriday = new Date("2026-11-13T22:30:00Z");

  it("gives the date on the zone's own clock", () => {
    expect(getDateInTimeZone("Europe/Vilnius", lateFriday)).toBe("2026-11-14");
    expect(getDateInTimeZone("America/New_York", lateFriday)).toBe("2026-11-13");
    expect(getDateInTimeZone("UTC", lateFriday)).toBe("2026-11-13");
  });

  it("covers the zones furthest ahead and behind", () => {
    const noonUtc = new Date("2026-11-13T12:00:00Z");
    expect(getDateInTimeZone("Pacific/Kiritimati", noonUtc)).toBe("2026-11-14");
    expect(getDateInTimeZone("Etc/GMT+12", noonUtc)).toBe("2026-11-13");
  });

  it("follows daylight saving time", () => {
    // Vilnius is UTC+3 in summer and UTC+2 in winter.
    expect(getDateInTimeZone("Europe/Vilnius", new Date("2026-07-03T21:30:00Z"))).toBe("2026-07-04");
    expect(getDateInTimeZone("Europe/Vilnius", new Date("2026-12-04T21:30:00Z"))).toBe("2026-12-04");
  });

  it("pads months and days, and crosses into a new year", () => {
    expect(getDateInTimeZone("Asia/Tokyo", new Date("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
  });

  it("refuses a zone it does not know", () => {
    expect(() => getDateInTimeZone("Mars/Olympus_Mons", lateFriday)).toThrow(RangeError);
  });
});
