import { describe, expect, it } from "vitest";
import en from "../../i18n/locales/en.json";
import lt from "../../i18n/locales/lt.json";
import {
  GENERIC_MEAL_PLAN_ERROR_KEY,
  MEAL_PLAN_ERROR_KEY_BY_MESSAGE,
  PARTICIPANTS_SAVE_FAILED_KEY,
  SLOT_ERROR_KEY_BY_MESSAGE,
  SLOT_SAVE_FAILED_KEY,
  getMealPlanErrorKey,
  getParticipantsErrorKey,
  getSlotErrorKey,
} from "./getMealPlanErrorKey";

const lookUp = (messages: unknown, key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages);

describe("getMealPlanErrorKey", () => {
  it.each(Object.entries(MEAL_PLAN_ERROR_KEY_BY_MESSAGE))("maps %s to %s", (message, key) => {
    expect(getMealPlanErrorKey({ message })).toBe(key);
  });

  it("falls back to the generic message for anything else", () => {
    expect(getMealPlanErrorKey({ message: "connection reset" })).toBe(GENERIC_MEAL_PLAN_ERROR_KEY);
    expect(getMealPlanErrorKey({ message: "" })).toBe(GENERIC_MEAL_PLAN_ERROR_KEY);
  });

  it("uses the same messages for saving participants, with its own fallback", () => {
    expect(getParticipantsErrorKey({ message: "no_participants" })).toBe("plan.errors.noParticipants");
    expect(getParticipantsErrorKey({ message: "participant_not_member" })).toBe("plan.errors.participantNotMember");
    expect(getParticipantsErrorKey({ message: "plan_not_found" })).toBe(PARTICIPANTS_SAVE_FAILED_KEY);
  });

  it.each(Object.entries(SLOT_ERROR_KEY_BY_MESSAGE))("maps the slot message %s to %s", (message, key) => {
    expect(getSlotErrorKey({ message })).toBe(key);
  });

  it("falls back to the slot save message for anything else", () => {
    expect(getSlotErrorKey({ message: "connection reset" })).toBe(SLOT_SAVE_FAILED_KEY);
  });

  it.each([
    ...Object.values(MEAL_PLAN_ERROR_KEY_BY_MESSAGE),
    ...Object.values(SLOT_ERROR_KEY_BY_MESSAGE),
    GENERIC_MEAL_PLAN_ERROR_KEY,
    PARTICIPANTS_SAVE_FAILED_KEY,
    SLOT_SAVE_FAILED_KEY,
  ])(
    "has %s in English and Lithuanian",
    (key) => {
      expect(typeof lookUp(en, key)).toBe("string");
      expect(typeof lookUp(lt, key)).toBe("string");
    },
  );
});
