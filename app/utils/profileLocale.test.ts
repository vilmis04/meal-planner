import { describe, expect, it } from "vitest";
import { resolveProfileLocale } from "./profileLocale";

describe("resolveProfileLocale", () => {
  it("lets the profile's language win over the cookie", () => {
    expect(resolveProfileLocale({ profileLocale: "lt", activeLocale: "en", hasUnsavedChoice: false })).toEqual({
      locale: "lt",
      isSaveNeeded: false,
    });
  });

  it("keeps a language chosen while signed out and saves it to the profile", () => {
    expect(resolveProfileLocale({ profileLocale: "en", activeLocale: "lt", hasUnsavedChoice: true })).toEqual({
      locale: "lt",
      isSaveNeeded: true,
    });
  });

  it("does not save a choice the profile already has", () => {
    expect(resolveProfileLocale({ profileLocale: "lt", activeLocale: "lt", hasUnsavedChoice: true })).toEqual({
      locale: "lt",
      isSaveNeeded: false,
    });
  });

  it.each([true, false])("gives a new profile the language being browsed in (unsaved choice: %s)", (hasUnsavedChoice) => {
    expect(resolveProfileLocale({ profileLocale: null, activeLocale: "lt", hasUnsavedChoice })).toEqual({
      locale: "lt",
      isSaveNeeded: true,
    });
  });
});
