import { describe, expect, it } from "vitest";
import en from "../../i18n/locales/en.json";
import lt from "../../i18n/locales/lt.json";
import {
  SHOPPING_ITEM_ERROR_KEY_BY_MESSAGE,
  SHOPPING_ITEM_SAVE_FAILED_KEY,
  getShoppingItemErrorKey,
} from "./getShoppingItemErrorKey";

const lookUp = (messages: unknown, key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages);

describe("getShoppingItemErrorKey", () => {
  it.each(Object.entries(SHOPPING_ITEM_ERROR_KEY_BY_MESSAGE))("maps %s to %s", (message, key) => {
    expect(getShoppingItemErrorKey({ message })).toBe(key);
  });

  it("falls back to a plain failure for anything else", () => {
    expect(getShoppingItemErrorKey({ message: "connection reset" })).toBe(SHOPPING_ITEM_SAVE_FAILED_KEY);
    expect(getShoppingItemErrorKey({ message: "invalid_category" })).toBe(SHOPPING_ITEM_SAVE_FAILED_KEY);
  });

  it.each([...Object.values(SHOPPING_ITEM_ERROR_KEY_BY_MESSAGE), SHOPPING_ITEM_SAVE_FAILED_KEY])(
    "has %s in both languages",
    (key) => {
      expect(typeof lookUp(en, key)).toBe("string");
      expect(typeof lookUp(lt, key)).toBe("string");
    },
  );
});
