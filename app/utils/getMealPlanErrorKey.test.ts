import { describe, expect, it } from "vitest";
import en from "../../i18n/locales/en.json";
import lt from "../../i18n/locales/lt.json";
import {
  GENERATION_ERROR_KEY_BY_STATUS,
  GENERATION_FAILED_KEY,
  GENERIC_MEAL_PLAN_ERROR_KEY,
  LOCK_ERROR_KEY_BY_MESSAGE,
  LOCK_SAVE_FAILED_KEY,
  MEAL_PLAN_ERROR_KEY_BY_MESSAGE,
  PARTICIPANTS_SAVE_FAILED_KEY,
  SLOT_ERROR_KEY_BY_MESSAGE,
  SLOT_SAVE_FAILED_KEY,
  SWAP_ERROR_KEY_BY_STATUS,
  SWAP_FAILED_KEY,
  getGenerationErrorKey,
  getLockErrorKey,
  getMealPlanErrorKey,
  getParticipantsErrorKey,
  getSlotErrorKey,
  getSwapErrorKey,
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

  it.each(Object.entries(GENERATION_ERROR_KEY_BY_STATUS))("maps the generation answer %s to %s", (status, key) => {
    expect(getGenerationErrorKey(409, status)).toBe(key);
  });

  it("reads a generation 404 as a plan that is not available, and anything else as a failure", () => {
    expect(getGenerationErrorKey(404, null)).toBe("plan.errors.notFound");
    expect(getGenerationErrorKey(500, null)).toBe(GENERATION_FAILED_KEY);
    expect(getGenerationErrorKey(null, null)).toBe(GENERATION_FAILED_KEY);
    expect(getGenerationErrorKey(409, "something-new")).toBe(GENERATION_FAILED_KEY);
  });

  it.each(Object.entries(SWAP_ERROR_KEY_BY_STATUS))("maps the swap answer %s to %s", (status, key) => {
    expect(getSwapErrorKey(409, status)).toBe(key);
  });

  it("reads a swap 404 as a plan that is not available, and anything else as a failure", () => {
    expect(getSwapErrorKey(404, null)).toBe("plan.errors.notFound");
    expect(getSwapErrorKey(500, null)).toBe(SWAP_FAILED_KEY);
    expect(getSwapErrorKey(409, "something-new")).toBe(SWAP_FAILED_KEY);
  });

  it.each(Object.entries(LOCK_ERROR_KEY_BY_MESSAGE))("maps the lock error %s to %s", (message, key) => {
    expect(getLockErrorKey({ message })).toBe(key);
  });

  it("falls back to a plain lock failure", () => {
    expect(getLockErrorKey({ message: "invalid_slots" })).toBe(LOCK_SAVE_FAILED_KEY);
  });

  it.each([
    ...Object.values(MEAL_PLAN_ERROR_KEY_BY_MESSAGE),
    ...Object.values(SWAP_ERROR_KEY_BY_STATUS),
    SWAP_FAILED_KEY,
    ...Object.values(LOCK_ERROR_KEY_BY_MESSAGE),
    LOCK_SAVE_FAILED_KEY,
    ...Object.values(GENERATION_ERROR_KEY_BY_STATUS),
    GENERATION_FAILED_KEY,
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
