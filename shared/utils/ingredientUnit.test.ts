import { describe, expect, it } from "vitest";
import { getUnitsWithBase, normaliseUnit, toBaseQuantity, toDisplayQuantity } from "./ingredientUnit";

describe("normaliseUnit", () => {
  it.each([
    ["g", "g"],
    [" G ", "g"],
    ["Kg", "kg"],
    ["ML", "ml"],
    ["vnt.", "vnt."],
    ["vnt", "vnt."],
    ["VNT", "vnt."],
    ["galvos", "galva"],
    ["galva", "galva"],
    ["skiltelė", "skiltelė"],
    ["v.š.", "v.š."],
  ])("reads %j as %j", (unit, expected) => {
    expect(normaliseUnit(unit)).toBe(expected);
  });
});

describe("toBaseQuantity", () => {
  it("turns kilograms into grams", () => {
    expect(toBaseQuantity({ amount: 1.5, unit: "kg" })).toEqual({ amount: 1500, unit: "g" });
  });

  it("turns litres into millilitres", () => {
    expect(toBaseQuantity({ amount: 0.25, unit: "l" })).toEqual({ amount: 250, unit: "ml" });
  });

  it("keeps grams and millilitres", () => {
    expect(toBaseQuantity({ amount: 80, unit: "g" })).toEqual({ amount: 80, unit: "g" });
    expect(toBaseQuantity({ amount: 200, unit: "ml" })).toEqual({ amount: 200, unit: "ml" });
  });

  it("does not leave floating point noise", () => {
    expect(toBaseQuantity({ amount: 1.13, unit: "kg" })).toEqual({ amount: 1130, unit: "g" });
  });

  it("counts pieces on their own, never as grams", () => {
    expect(toBaseQuantity({ amount: 2, unit: "vnt." })).toEqual({ amount: 2, unit: "vnt." });
    expect(toBaseQuantity({ amount: 3, unit: "vnt" })).toEqual({ amount: 3, unit: "vnt." });
  });

  it.each(["skiltelė", "v.š.", "a.š.", "riekelė", "skardinė", "pakuotė", "galva", "juostelės", "citrinos"])(
    "keeps %s as written",
    (unit) => {
      expect(toBaseQuantity({ amount: 0.5, unit })).toEqual({ amount: 0.5, unit });
    },
  );

  it("merges the plural spelling of a head", () => {
    expect(toBaseQuantity({ amount: 0.5, unit: "galvos" })).toEqual({ amount: 0.5, unit: "galva" });
  });
});

describe("toDisplayQuantity", () => {
  it.each([
    [{ amount: 1000, unit: "g" }, { amount: 1, unit: "kg" }],
    [{ amount: 1250, unit: "g" }, { amount: 1.25, unit: "kg" }],
    [{ amount: 1001, unit: "g" }, { amount: 1.001, unit: "kg" }],
    [{ amount: 999, unit: "g" }, { amount: 999, unit: "g" }],
    [{ amount: 1500, unit: "ml" }, { amount: 1.5, unit: "l" }],
    [{ amount: 330, unit: "ml" }, { amount: 330, unit: "ml" }],
    [{ amount: 2, unit: "kg" }, { amount: 2, unit: "kg" }],
    [{ amount: 0.5, unit: "kg" }, { amount: 500, unit: "g" }],
    [{ amount: 1200, unit: "vnt." }, { amount: 1200, unit: "vnt." }],
    [{ amount: 4, unit: "skiltelė" }, { amount: 4, unit: "skiltelė" }],
  ])("shows %j as %j", (quantity, expected) => {
    expect(toDisplayQuantity(quantity)).toEqual(expected);
  });
});

describe("getUnitsWithBase", () => {
  it("offers the larger unit next to grams and millilitres", () => {
    expect(getUnitsWithBase("g")).toEqual(["g", "kg"]);
    expect(getUnitsWithBase("ml")).toEqual(["ml", "l"]);
  });

  it("offers a unit counted on its own as itself", () => {
    expect(getUnitsWithBase("vnt.")).toEqual(["vnt."]);
    expect(getUnitsWithBase("skiltelė")).toEqual(["skiltelė"]);
  });
});
