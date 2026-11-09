import type { IngredientQuantity, UnitConversion } from "./ingredientUnit.types";

/*
 * Unit rules (G1). A shopping list (G2) adds up the amounts of one ingredient only when they are in the same unit,
 * so every amount is first brought to its base unit:
 *   * mass in grams: 1 kg is 1000 g;
 *   * volume in millilitres: 1 l is 1000 ml;
 *   * pieces ("vnt.") are counted on their own and never turned into grams: 2 vnt. and 120 g of eggs stay two lines,
 *     because a piece has no fixed weight;
 *   * every other unit the recipes use (skiltelė, v.š., a.š., riekelė, skardinė, pakuotė, galva, juostelės,
 *     citrinos) is counted on its own as well, as written. Weights per piece or spoon would differ per ingredient.
 * Spellings are tidied first (case, spaces, "vnt" without the dot, the plural "galvos"), so equal units merge.
 * For reading, a total goes back up to the larger unit: 1000 g or more is shown in kg, 1000 ml or more in l.
 */

const CONVERSIONS: readonly UnitConversion[] = [
  { unit: "kg", baseUnit: "g", factor: 1000 },
  { unit: "l", baseUnit: "ml", factor: 1000 },
];

// Other spellings of a unit, after trimming and lower-casing. The seed writes "galvos" once next to "galva".
const UNIT_SPELLINGS: ReadonlyMap<string, string> = new Map([
  ["vnt", "vnt."],
  ["galvos", "galva"],
]);

// recipe_ingredients.amount is numeric(8, 2); a sum of such amounts needs no more.
const BASE_FRACTION_DIGITS = 2;
// 1 g in kg.
const DISPLAY_FRACTION_DIGITS = 3;

export function normaliseUnit(unit: string): string {
  const tidiedUnit = unit.trim().toLowerCase();
  return UNIT_SPELLINGS.get(tidiedUnit) ?? tidiedUnit;
}

// The amount in its base unit (g, ml), or as written for a unit that is counted on its own.
export function toBaseQuantity(quantity: IngredientQuantity): IngredientQuantity {
  const unit = normaliseUnit(quantity.unit);
  const conversion = CONVERSIONS.find((candidate) => candidate.unit === unit);
  if (conversion === undefined) {
    return { amount: quantity.amount, unit };
  }

  return { amount: roundTo(quantity.amount * conversion.factor, BASE_FRACTION_DIGITS), unit: conversion.baseUnit };
}

// The amount in the largest unit that keeps it at 1 or more: 1500 g reads 1.5 kg, 900 g stays 900 g.
export function toDisplayQuantity(quantity: IngredientQuantity): IngredientQuantity {
  const baseQuantity = toBaseQuantity(quantity);
  const conversion = CONVERSIONS.find(
    (candidate) => candidate.baseUnit === baseQuantity.unit && baseQuantity.amount >= candidate.factor,
  );
  if (conversion === undefined) {
    return baseQuantity;
  }

  return {
    amount: roundTo(baseQuantity.amount / conversion.factor, DISPLAY_FRACTION_DIGITS),
    unit: conversion.unit,
  };
}

// The units an amount in this base unit can be typed in: g or kg for grams, ml or l for millilitres, and a unit counted
// on its own only as itself.
export function getUnitsWithBase(baseUnit: string): string[] {
  const largerUnits = CONVERSIONS.filter((conversion) => conversion.baseUnit === baseUnit).map(
    (conversion) => conversion.unit,
  );
  return [baseUnit, ...largerUnits];
}

const roundTo = (value: number, fractionDigits: number): number => {
  const scale = 10 ** fractionDigits;
  return Math.round(value * scale) / scale;
};
