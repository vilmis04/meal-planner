import { normaliseUnit } from "#shared/utils/ingredientUnit";

/*
 * The units recipes and shopping lists write, as stored (Lithuanian, from the seed: vnt., v.š., skiltelė), and the
 * message that names each in the viewer's language (X1b). A message with plural forms takes the amount ("2 cloves",
 * "2 skiltelės"). Grams, millilitres, kilograms and litres read the same in both languages and have no message; any
 * other unit is shown as written, which is how a line's own translated unit (a lime "wedge") reads.
 */
const UNIT_LABEL_KEYS: ReadonlyMap<string, string> = new Map([
  ["vnt.", "units.pieces"],
  ["pakuotė", "units.pack"],
  ["v.š.", "units.tablespoon"],
  ["a.š.", "units.teaspoon"],
  ["skiltelė", "units.clove"],
  ["riekelė", "units.slice"],
  ["skardinė", "units.can"],
  ["galva", "units.head"],
  ["juostelės", "units.strip"],
  ["citrinos", "units.lemon"],
]);

// The message for a unit, after the spelling is tidied (normaliseUnit(): "Vnt", "galvos"); null to show it as written.
export const getUnitLabelKey = (unit: string): string | null => UNIT_LABEL_KEYS.get(normaliseUnit(unit)) ?? null;
