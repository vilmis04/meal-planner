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
