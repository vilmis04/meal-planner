import type { z } from "zod";
import type { Diet, Protein } from "./diet";
import type { SWAP_LOCALES } from "./proteinSwap";
import type { swapResponseSchema } from "./proteinSwap.schema";

export type SwapLocale = (typeof SWAP_LOCALES)[number];

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

// The answer as the model returns it (snake_case, like SWAP_RESPONSE_JSON_SCHEMA).
export type SwapResponse = z.infer<typeof swapResponseSchema>;

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

// A swap's text in one language (X1c): its note, and each replacement's item.
export interface SwapNoteText {
  locale: string;
  note: string | null;
}

export interface SwapItemText {
  locale: string;
  item: string;
}

/*
 * What the API returns for a ready swap: each replaced ingredient next to its original. note and item are the
 * Lithuanian source; notes and texts hold every language the swap is stored in, so the page picks the viewer's
 * (localizeSwap() in shared/utils/recipeSwap.ts) and follows a switch of language without asking again.
 */
export interface ProteinSwapView {
  recipeId: string;
  diet: Diet;
  locale: SwapLocale;
  note: string | null;
  notes: SwapNoteText[];
  nutrition: SwapNutrition | null;
  nutritionApproximate: true;
  generatedAt: string;
  items: {
    position: number;
    original: { item: string; amount: number | null; unit: string | null };
    item: string;
    texts: SwapItemText[];
    amount: number | null;
    unit: string | null;
    replacementProtein: Protein;
  }[];
}

// What a swap's translation is made from (X1c): the Lithuanian swap, with the recipe lines it replaces for context.
export interface SwapTranslationSource {
  recipeName: string;
  diet: Diet;
  note: string | null;
  items: {
    recipeIngredientId: string;
    position: number;
    // The recipe line it replaces, in Lithuanian and (when the recipe has it) in the target language.
    original: string;
    originalTranslated: string | null;
    item: string;
    replacementProtein: Protein;
  }[];
}

// A validated translation, with the Lithuanian text it was made from (save_recipe_protein_swap_translation() checks it).
export interface SwapTranslation {
  locale: SwapLocale;
  sourceNote: string | null;
  note: string | null;
  items: { recipeIngredientId: string; sourceItem: string; item: string }[];
}

export type SwapTranslationValidation = { ok: true; translation: SwapTranslation } | { ok: false; errors: string[] };
