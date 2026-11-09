import { describe, expect, it } from "vitest";
import en from "../../i18n/locales/en.json";
import lt from "../../i18n/locales/lt.json";
import {
  PLAN_SCHEDULE_ERROR_KEY_BY_MESSAGE,
  PLAN_SCHEDULE_SAVE_FAILED_KEY,
  getPlanScheduleErrorKey,
} from "./getPlanScheduleErrorKey";

const lookUp = (messages: unknown, key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages);

describe("getPlanScheduleErrorKey", () => {
  it.each(Object.entries(PLAN_SCHEDULE_ERROR_KEY_BY_MESSAGE))("maps %s to %s", (message, key) => {
    expect(getPlanScheduleErrorKey({ message })).toBe(key);
  });

  it("falls back to a plain failure for anything else", () => {
    expect(getPlanScheduleErrorKey({ message: "connection reset" })).toBe(PLAN_SCHEDULE_SAVE_FAILED_KEY);
    expect(getPlanScheduleErrorKey({ message: "participants_not_allowed" })).toBe(PLAN_SCHEDULE_SAVE_FAILED_KEY);
  });

  it.each([...Object.values(PLAN_SCHEDULE_ERROR_KEY_BY_MESSAGE), PLAN_SCHEDULE_SAVE_FAILED_KEY])(
    "has %s in both languages",
    (key) => {
      expect(typeof lookUp(en, key)).toBe("string");
      expect(typeof lookUp(lt, key)).toBe("string");
    },
  );
});
