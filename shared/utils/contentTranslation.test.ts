import { describe, expect, it } from "vitest";
import { CONTENT_SOURCE_LOCALE, pickTranslation } from "./contentTranslation";

const NAMES = [
  { locale: "lt", name: "Graikiškos salotos" },
  { locale: "en", name: "Greek salad" },
];

describe("pickTranslation", () => {
  it("picks the active language", () => {
    expect(pickTranslation(NAMES, "en")?.name).toBe("Greek salad");
    expect(pickTranslation(NAMES, "lt")?.name).toBe("Graikiškos salotos");
  });

  it("falls back to Lithuanian when the active language has no row", () => {
    expect(pickTranslation([NAMES[0]!], "en")?.name).toBe("Graikiškos salotos");
    expect(pickTranslation(NAMES, "de")?.name).toBe("Graikiškos salotos");
  });

  it("finds nothing when neither the active language nor Lithuanian has a row", () => {
    expect(pickTranslation([NAMES[1]!], "lt")).toBeUndefined();
    expect(pickTranslation([], "en")).toBeUndefined();
  });

  it("falls back to Lithuanian, the source language", () => {
    expect(CONTENT_SOURCE_LOCALE).toBe("lt");
  });
});
