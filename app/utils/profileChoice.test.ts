import { describe, expect, it } from "vitest";
import { resolveProfileChoice } from "./profileChoice";

describe("resolveProfileChoice", () => {
  it("lets the profile's value win over the cookie", () => {
    expect(resolveProfileChoice({ profileValue: "lt", activeValue: "en", hasUnsavedChoice: false })).toEqual({
      value: "lt",
      isSaveNeeded: false,
    });
  });

  it("keeps a value chosen while signed out and saves it to the profile", () => {
    expect(resolveProfileChoice({ profileValue: "light", activeValue: "dark", hasUnsavedChoice: true })).toEqual({
      value: "dark",
      isSaveNeeded: true,
    });
  });

  it("does not save a choice the profile already has", () => {
    expect(resolveProfileChoice({ profileValue: "lt", activeValue: "lt", hasUnsavedChoice: true })).toEqual({
      value: "lt",
      isSaveNeeded: false,
    });
  });

  it.each([true, false])("gives a profile without a value the one in use (unsaved choice: %s)", (hasUnsavedChoice) => {
    expect(resolveProfileChoice({ profileValue: null, activeValue: "lt", hasUnsavedChoice })).toEqual({
      value: "lt",
      isSaveNeeded: true,
    });
  });
});
