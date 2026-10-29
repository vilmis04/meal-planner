/*
 * The diet ladder, defined once.
 *
 * A diet is a step on a ladder. Each step lists only the proteins it adds, and a diet allows the
 * proteins of its own step and of every step before it, so "each level includes the proteins of the
 * levels it implies" holds by construction and the steps cannot drift out of order.
 *
 *   vegetarian  egg/dairy, plant
 *   fish        + fish
 *   poultry     + poultry
 *   pork        + pork
 *   beef        + beef
 *   full        + other meat (lamb, game, offal): everything
 *
 * To add or reorder a step, change DIET_LADDER only, then update the profiles_diet_supported
 * constraint in a new migration and the profile.diet.* translations. The proteins are the vocabulary
 * recipes will be tagged with (D1).
 */

export const PROTEINS = ["egg_dairy", "plant", "fish", "poultry", "pork", "beef", "other_meat"] as const;
export type Protein = (typeof PROTEINS)[number];

interface DietStep {
  diet: string;
  adds: readonly Protein[];
}

const DIET_LADDER = [
  { diet: "vegetarian", adds: ["egg_dairy", "plant"] },
  { diet: "fish", adds: ["fish"] },
  { diet: "poultry", adds: ["poultry"] },
  { diet: "pork", adds: ["pork"] },
  { diet: "beef", adds: ["beef"] },
  { diet: "full", adds: ["other_meat"] },
] as const satisfies readonly DietStep[];

export type Diet = (typeof DIET_LADDER)[number]["diet"];

// Lowest to highest, the order the profile screen lists them in. Must match the profiles_diet_supported constraint.
export const DIETS = DIET_LADDER.map((step) => step.diet) as [Diet, ...Diet[]];

export function allowedProteins(diet: Diet): readonly Protein[] {
  const stepCount = DIETS.indexOf(diet) + 1;
  return DIET_LADDER.slice(0, stepCount).flatMap((step) => step.adds);
}

export function isProteinAllowed(diet: Diet, protein: Protein): boolean {
  return allowedProteins(diet).includes(protein);
}
