/*
 * Protein swaps (D2): the rules for asking an AI to replace the proteins a diet excludes, and for checking
 * its answer before anything is stored.
 *
 * Pure on purpose (no database, network or framework imports): the server's on-demand service, the backfill
 * script and the tests all use it. Imports are relative so the script can run outside Nuxt.
 */
import { z } from "zod";
import { DIETS, PROTEINS, allowedProteins, isProteinAllowed, isRecipeCompatible } from "./diet";
import type { Diet, Protein } from "./diet";

// Bump when the prompt or the rules change in a way that should regenerate stored swaps.
export const PROMPT_VERSION = 1;

// Swaps are written in the recipe content language; X1c adds English.
export const SWAP_LOCALES = ["lt", "en"] as const;
export type SwapLocale = (typeof SWAP_LOCALES)[number];
export const DEFAULT_SWAP_LOCALE: SwapLocale = "lt";

// A pending claim older than this belongs to a request that died; claim_recipe_protein_swap() uses the same.
export const CLAIM_TTL_MS = 2 * 60 * 1000;

const MAX_ITEM_LENGTH = 120;
const MAX_NOTE_LENGTH = 300;
const MAX_AMOUNT = 999_999.99; // numeric(8, 2)
const MAX_AMOUNT_FACTOR = 3; // a replacement may use at most 3x the original amount in the same unit
const NUTRITION_MIN_FACTOR = 0.5;
const NUTRITION_MAX_FACTOR = 1.5;
const MAX_KCAL_WITHOUT_ORIGINAL = 2000;

export interface SwapIngredient {
  id: string;
  position: number;
  item: string;
  amount: number | null;
  unit: string | null;
}

export interface SwapNutrition {
  caloriesKcal: number | null;
  carbohydrates: number | null;
  protein: number | null;
  fat: number | null;
}

export interface SwapRecipe {
  id: string;
  name: string;
  mainProteins: readonly Protein[];
  ingredients: readonly SwapIngredient[];
  nutrition: SwapNutrition;
}

export interface ValidatedSwapItem {
  recipeIngredientId: string;
  position: number;
  originalProtein: Protein;
  item: string;
  amount: number | null;
  unit: string | null;
  replacementProtein: Protein;
}

export interface ValidatedSwap {
  items: ValidatedSwapItem[];
  note: string | null;
  // Null when the estimate was missing or implausible; always approximate.
  nutrition: SwapNutrition | null;
}

export type SwapValidation = { ok: true; swap: ValidatedSwap } | { ok: false; errors: string[] };

// The diets a recipe does not fit, lowest first. Empty for recipes every diet allows.
export function conflictingDiets(mainProteins: readonly Protein[]): Diet[] {
  return DIETS.filter((diet) => !isRecipeCompatible(diet, mainProteins));
}

// The recipe's main proteins that the diet does not allow: what a swap must replace.
export function excludedProteins(diet: Diet, mainProteins: readonly Protein[]): Protein[] {
  return mainProteins.filter((protein) => !isProteinAllowed(diet, protein));
}

// Proteins the recipe has after the swap: the replaced ones go, the replacements come in.
export function swappedProteins(
  mainProteins: readonly Protein[],
  items: readonly Pick<ValidatedSwapItem, "originalProtein" | "replacementProtein">[],
): Protein[] {
  const replaced = new Set(items.map((item) => item.originalProtein));
  const result = new Set(mainProteins.filter((protein) => !replaced.has(protein)));
  for (const item of items) result.add(item.replacementProtein);
  return [...result];
}

const PROTEIN_LABELS: Record<Protein, string> = {
  egg_dairy: "kiaušiniai ir pieno produktai (eggs and dairy)",
  plant: "augaliniai baltymai (plant protein: tofu, soy, legumes, plant-based mince)",
  fish: "žuvis ir jūros gėrybės (fish and seafood)",
  poultry: "paukštiena (poultry)",
  pork: "kiauliena (pork)",
  beef: "jautiena (beef)",
  other_meat: "kita mėsa (lamb, game, offal)",
};

function formatIngredient(ingredient: SwapIngredient): string {
  const amount = ingredient.amount === null ? "pagal skonį (to taste)" : `${ingredient.amount} ${ingredient.unit}`;
  return `${ingredient.position}. ${ingredient.item}: ${amount}`;
}

/*
 * The prompt for one recipe and diet. Only recipe text goes in (no user data). previousErrors are the
 * validation errors of the last answer, so the model can correct itself on a retry.
 */
export function buildSwapPrompt(recipe: SwapRecipe, diet: Diet, previousErrors: readonly string[] = []): string {
  const excluded = excludedProteins(diet, recipe.mainProteins);
  const allowed = allowedProteins(diet);
  const lines = [
    "You adapt recipes for a meal planner. Answer with JSON only, matching the given schema.",
    "",
    `Recipe: ${recipe.name}`,
    "Ingredients (position. name: amount unit):",
    ...recipe.ingredients.map(formatIngredient),
    "",
    `Main proteins of the recipe: ${recipe.mainProteins.join(", ")}`,
    `Diet: ${diet}. The diet does NOT allow: ${excluded.map((protein) => PROTEIN_LABELS[protein]).join("; ")}.`,
    `Allowed protein groups: ${allowed.map((protein) => `${protein} = ${PROTEIN_LABELS[protein]}`).join("; ")}.`,
    "",
    "Task:",
    "- Replace every ingredient that contains a protein the diet does not allow, and nothing else.",
    "- For each replaced ingredient give its position, original_protein (one of the excluded groups), the",
    "  replacement item name in Lithuanian, the amount and unit, and replacement_protein (an allowed group).",
    "- Keep the amount protein-equivalent and practical; use the recipe's units (g, ml, vnt.) where possible.",
    "  Amount and unit are both null only for a to-taste item.",
    "- Prefer the closest allowed protein, e.g. chicken to white fish for a fish diet; cold cuts to halloumi or",
    "  other cheese, beef mince to plant-based mince, chicken to soy chunks or tofu for a vegetarian diet.",
    "  Guidance from the recipe book: 100 g vištienos = 100 g baltos žuvies; 100 g jautienos = 100 g lašišos.",
    "- note: one short cooking tip in Lithuanian for the replacement (max 300 characters), or null.",
    "- nutrition: your estimate for one serving of the whole swapped recipe (calories_kcal, carbohydrates,",
    `  protein, fat in grams). The original per serving: ${formatNutrition(recipe.nutrition)}.`,
  ];

  if (previousErrors.length > 0) {
    lines.push("", "Your previous answer was rejected. Fix these problems:", ...previousErrors.map((e) => `- ${e}`));
  }
  return lines.join("\n");
}

function formatNutrition(nutrition: SwapNutrition): string {
  const value = (n: number | null) => (n === null ? "unknown" : String(n));
  return `${value(nutrition.caloriesKcal)} kcal, carbohydrates ${value(nutrition.carbohydrates)} g, protein ${value(
    nutrition.protein,
  )} g, fat ${value(nutrition.fat)} g`;
}

const proteinSchema = z.enum(PROTEINS);
const nullableNumber = z.number().finite().nullable();

// The answer as the model returns it (snake_case, like the JSON schema below).
export const swapResponseSchema = z.object({
  swaps: z
    .array(
      z.object({
        position: z.number().int(),
        original_protein: proteinSchema,
        item: z.string(),
        amount: nullableNumber,
        unit: z.string().nullable(),
        replacement_protein: proteinSchema,
      }),
    )
    .min(1),
  note: z.string().nullable(),
  nutrition: z
    .object({
      calories_kcal: nullableNumber,
      carbohydrates: nullableNumber,
      protein: nullableNumber,
      fat: nullableNumber,
    })
    .nullable(),
});

export type SwapResponse = z.infer<typeof swapResponseSchema>;

// The same shape for the AI's structured output (OpenAPI subset, as Gemini's responseSchema takes it).
export const SWAP_RESPONSE_JSON_SCHEMA = {
  type: "OBJECT",
  properties: {
    swaps: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          position: { type: "INTEGER" },
          original_protein: { type: "STRING", enum: [...PROTEINS] },
          item: { type: "STRING" },
          amount: { type: "NUMBER", nullable: true },
          unit: { type: "STRING", nullable: true },
          replacement_protein: { type: "STRING", enum: [...PROTEINS] },
        },
        required: ["position", "original_protein", "item", "amount", "unit", "replacement_protein"],
      },
    },
    note: { type: "STRING", nullable: true },
    nutrition: {
      type: "OBJECT",
      nullable: true,
      properties: {
        calories_kcal: { type: "NUMBER", nullable: true },
        carbohydrates: { type: "NUMBER", nullable: true },
        protein: { type: "NUMBER", nullable: true },
        fat: { type: "NUMBER", nullable: true },
      },
      required: ["calories_kcal", "carbohydrates", "protein", "fat"],
    },
  },
  required: ["swaps", "note", "nutrition"],
} as const;

/*
 * Word stems that name a protein, in Lithuanian and English. A replacement whose name contains a stem of a
 * protein the diet excludes is rejected even if the model labelled it allowed: a second line of defence.
 * Plant-based imitations ("augalinė vištiena", "vegan chicken") are exempt when labelled plant.
 */
const PROTEIN_STEMS: Partial<Record<Protein, readonly string[]>> = {
  fish: ["žuv", "lašiš", "tuno", "tunas", "menk", "krevet", "lydek", "upėtak", "silk", "fish", "salmon", "tuna", "cod", "shrimp", "prawn", "trout"],
  poultry: ["vištien", "kalakut", "paukštien", "antien", "chicken", "turkey", "duck"],
  pork: ["kiaul", "kump", "šonin", "bekon", "pork", "ham", "bacon"],
  beef: ["jautien", "veršien", "beef", "veal"],
  other_meat: ["ėrien", "avien", "elnien", "kepen", "lamb", "mutton", "venison", "liver"],
};
const PLANT_MARKERS = ["augalin", "vegan", "veget", "soj", "plant-based", "plant based", "tofu", "seitan"];

function namedExcludedProtein(item: string, diet: Diet, replacementProtein: Protein): Protein | null {
  const name = item.toLocaleLowerCase("lt");
  if (replacementProtein === "plant" && PLANT_MARKERS.some((marker) => name.includes(marker))) {
    return null;
  }
  for (const [protein, stems] of Object.entries(PROTEIN_STEMS) as [Protein, readonly string[]][]) {
    if (!isProteinAllowed(diet, protein) && stems.some((stem) => name.includes(stem))) {
      return protein;
    }
  }
  return null;
}

function plausibleNutrition(raw: SwapResponse["nutrition"], original: SwapNutrition): SwapNutrition | null {
  if (!raw) return null;
  const values = [raw.calories_kcal, raw.carbohydrates, raw.protein, raw.fat];
  if (values.some((value) => value === null || value < 0 || value > MAX_AMOUNT)) return null;

  const kcal = raw.calories_kcal!;
  if (original.caloriesKcal !== null) {
    if (kcal < original.caloriesKcal * NUTRITION_MIN_FACTOR || kcal > original.caloriesKcal * NUTRITION_MAX_FACTOR) {
      return null;
    }
  } else if (kcal > MAX_KCAL_WITHOUT_ORIGINAL) {
    return null;
  }

  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    caloriesKcal: round(kcal),
    carbohydrates: round(raw.carbohydrates!),
    protein: round(raw.protein!),
    fat: round(raw.fat!),
  };
}

/*
 * Checks an AI answer for a recipe and diet. Errors are short sentences the model can act on when it is asked
 * again. Nutrition never fails the swap: an implausible estimate is dropped instead.
 */
export function validateSwap(recipe: SwapRecipe, diet: Diet, raw: unknown): SwapValidation {
  const parsed = swapResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "answer"}: ${issue.message}`),
    };
  }

  const response = parsed.data;
  const errors: string[] = [];
  const byPosition = new Map(recipe.ingredients.map((ingredient) => [ingredient.position, ingredient]));
  const excluded = excludedProteins(diet, recipe.mainProteins);
  const seen = new Set<number>();
  const items: ValidatedSwapItem[] = [];

  for (const swap of response.swaps) {
    const label = `position ${swap.position}`;
    const ingredient = byPosition.get(swap.position);
    if (!ingredient) {
      errors.push(`${label}: the recipe has no ingredient at this position`);
      continue;
    }
    if (seen.has(swap.position)) {
      errors.push(`${label}: replaced more than once`);
      continue;
    }
    seen.add(swap.position);

    if (!excluded.includes(swap.original_protein)) {
      errors.push(
        `${label}: original_protein must be one the diet excludes (${excluded.join(", ")}), not ${swap.original_protein}`,
      );
    }
    if (!isProteinAllowed(diet, swap.replacement_protein)) {
      errors.push(`${label}: replacement_protein ${swap.replacement_protein} is not allowed by the ${diet} diet`);
    }

    const item = swap.item.trim();
    if (item.length === 0 || item.length > MAX_ITEM_LENGTH) {
      errors.push(`${label}: item must be 1 to ${MAX_ITEM_LENGTH} characters`);
    } else {
      const named = namedExcludedProtein(item, diet, swap.replacement_protein);
      if (named) errors.push(`${label}: "${item}" reads as ${named}, which the ${diet} diet excludes`);
    }

    const unit = swap.unit?.trim() || null;
    if ((swap.amount === null) !== (unit === null)) {
      errors.push(`${label}: amount and unit must both be set, or both be null for a to-taste item`);
    } else if (swap.amount !== null) {
      if (swap.amount <= 0 || swap.amount > MAX_AMOUNT) {
        errors.push(`${label}: amount must be above 0`);
      } else if (
        ingredient.amount !== null &&
        ingredient.unit === unit &&
        swap.amount > ingredient.amount * MAX_AMOUNT_FACTOR
      ) {
        errors.push(`${label}: ${swap.amount} ${unit} is more than ${MAX_AMOUNT_FACTOR}x the original amount`);
      }
    }

    items.push({
      recipeIngredientId: ingredient.id,
      position: swap.position,
      originalProtein: swap.original_protein,
      item,
      amount: swap.amount === null ? null : Math.round(swap.amount * 100) / 100,
      unit,
      replacementProtein: swap.replacement_protein,
    });
  }

  const covered = new Set(items.map((item) => item.originalProtein));
  const missing = excluded.filter((protein) => !covered.has(protein));
  if (missing.length > 0) {
    errors.push(`every excluded protein needs a replacement; missing: ${missing.join(", ")}`);
  }
  if (errors.length === 0 && !isRecipeCompatible(diet, swappedProteins(recipe.mainProteins, items))) {
    errors.push(`the swapped recipe still does not fit the ${diet} diet`);
  }

  const note = response.note?.trim() || null;
  if (note && note.length > MAX_NOTE_LENGTH) {
    errors.push(`note must be at most ${MAX_NOTE_LENGTH} characters`);
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    swap: {
      items: items.sort((a, b) => a.position - b.position),
      note,
      nutrition: plausibleNutrition(response.nutrition, recipe.nutrition),
    },
  };
}

export type SwapStatus = "pending" | "ready" | "failed" | "rejected";

export interface StoredSwapState {
  status: SwapStatus;
  claimedAt: Date | null;
  retryAfter: Date | null;
  sourceHash: string | null;
  promptVersion: number | null;
}

export type SwapCacheDecision =
  | { action: "hit" }
  | { action: "wait" }
  | { action: "unavailable"; retryAfter: Date }
  | { action: "generate" };

/*
 * What a request does with the stored row for its pair. Mirrors claim_recipe_protein_swap(): "generate" means
 * try to claim; the claim decides atomically if two requests race.
 */
export function swapCacheDecision(
  row: StoredSwapState | null,
  current: { sourceHash: string; promptVersion: number },
  now: Date,
): SwapCacheDecision {
  if (!row) return { action: "generate" };

  switch (row.status) {
    case "ready":
      return row.sourceHash === current.sourceHash && row.promptVersion === current.promptVersion
        ? { action: "hit" }
        : { action: "generate" };
    case "pending":
      return row.claimedAt && now.getTime() - row.claimedAt.getTime() < CLAIM_TTL_MS
        ? { action: "wait" }
        : { action: "generate" };
    case "failed":
      return row.retryAfter && row.retryAfter.getTime() > now.getTime()
        ? { action: "unavailable", retryAfter: row.retryAfter }
        : { action: "generate" };
    case "rejected":
      return { action: "generate" };
  }
}

const RETRY_DELAYS_MS = [5 * 60 * 1000, 60 * 60 * 1000, 24 * 60 * 60 * 1000];

// When a pair that has now failed `attempts` times may be tried again: 5 min, 1 h, then daily.
export function nextRetryAfter(attempts: number, now: Date): Date {
  const delay = RETRY_DELAYS_MS[Math.min(Math.max(attempts, 1), RETRY_DELAYS_MS.length) - 1]!;
  return new Date(now.getTime() + delay);
}

// What the API returns for a ready swap: each replaced ingredient next to its original.
export interface ProteinSwapView {
  recipeId: string;
  diet: Diet;
  locale: SwapLocale;
  note: string | null;
  nutrition: SwapNutrition | null;
  nutritionApproximate: true;
  generatedAt: string;
  items: {
    position: number;
    original: { item: string; amount: number | null; unit: string | null };
    item: string;
    amount: number | null;
    unit: string | null;
    replacementProtein: Protein;
  }[];
}
