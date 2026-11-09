import { describe, expect, it } from "vitest";
import en from "../../i18n/locales/en.json";
import lt from "../../i18n/locales/lt.json";
import { planNotificationRowsSchema } from "./planNotification";

const row = {
  id: "00000000-0000-4000-8000-0000000000a1",
  meal_plans: {
    id: "00000000-0000-4000-8000-0000000000b1",
    kind: "household",
    start_date: "2026-11-16",
    end_date: "2026-11-22",
  },
};

describe("planNotificationRowsSchema", () => {
  it("reads a notice with its plan's days", () => {
    expect(planNotificationRowsSchema.parse([row])).toEqual([
      {
        id: "00000000-0000-4000-8000-0000000000a1",
        planId: "00000000-0000-4000-8000-0000000000b1",
        planKind: "household",
        startDate: "2026-11-16",
        endDate: "2026-11-22",
      },
    ]);
  });

  it("refuses a notice without its plan, or with a plan it cannot read", () => {
    expect(planNotificationRowsSchema.safeParse([{ ...row, meal_plans: null }]).success).toBe(false);
    expect(planNotificationRowsSchema.safeParse([{ ...row, meal_plans: { ...row.meal_plans, kind: "team" } }]).success).toBe(
      false,
    );
    expect(
      planNotificationRowsSchema.safeParse([{ ...row, meal_plans: { ...row.meal_plans, end_date: "22.11.2026" } }]).success,
    ).toBe(false);
  });
});

describe("draft notice texts", () => {
  it.each(["plan.draftNotice.title", "plan.draftNotice.text", "plan.draftNotice.action"])("has %s in both languages", (key) => {
    const lookUp = (messages: unknown): unknown =>
      key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages);
    expect(typeof lookUp(en)).toBe("string");
    expect(typeof lookUp(lt)).toBe("string");
  });
});
