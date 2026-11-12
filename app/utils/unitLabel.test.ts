import { describe, expect, it } from "vitest";
import enMessages from "../../i18n/locales/en.json";
import ltMessages from "../../i18n/locales/lt.json";
import { getUnitLabelKey } from "./unitLabel";

// Every unit the seeded recipes write (recipe_ingredients.unit) and the shopping list form offers.
const SEEDED_UNITS = ["g", "kg", "ml", "l", "vnt.", "pakuotė", "v.š.", "a.š.", "skiltelė", "riekelė", "skardinė", "galva", "galvos", "juostelės", "citrinos"];
const METRIC_UNITS = new Set(["g", "kg", "ml", "l"]);

describe("getUnitLabelKey", () => {
  it("names the units the seeded recipes write", () => {
    expect(getUnitLabelKey("vnt.")).toBe("units.pieces");
    expect(getUnitLabelKey("v.š.")).toBe("units.tablespoon");
    expect(getUnitLabelKey("skiltelė")).toBe("units.clove");
  });

  it("tidies the spelling first", () => {
    expect(getUnitLabelKey("Vnt")).toBe("units.pieces");
    expect(getUnitLabelKey("galvos")).toBe("units.head");
  });

  it("leaves metric units and a line's own translated unit as written", () => {
    expect(getUnitLabelKey("g")).toBeNull();
    expect(getUnitLabelKey("ml")).toBeNull();
    expect(getUnitLabelKey("wedge")).toBeNull();
  });

  it("has a message in both languages for every unit the recipes write, metric ones aside", () => {
    for (const unit of SEEDED_UNITS.filter((candidate) => !METRIC_UNITS.has(candidate))) {
      const name = getUnitLabelKey(unit)?.split(".")[1] as keyof typeof enMessages.units;
      expect(enMessages.units[name], unit).toBeTruthy();
      expect(ltMessages.units[name], unit).toBeTruthy();
    }
  });
});
