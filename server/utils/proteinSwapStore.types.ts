import type { Diet, Protein } from "../../shared/utils/diet";
import type { SwapLocale, SwapRecipe, SwapStatus, ValidatedSwap } from "../../shared/utils/proteinSwap.types";

export interface StoredSwap {
  status: SwapStatus;
  claimedAt: Date | null;
  retryAfter: Date | null;
  attempts: number;
  sourceHash: string | null;
  promptVersion: number | null;
  note: string | null;
  caloriesKcal: number | null;
  carbohydrates: number | null;
  protein: number | null;
  fat: number | null;
  generatedAt: Date | null;
  items: {
    recipeIngredientId: string;
    item: string;
    amount: number | null;
    unit: string | null;
    replacementProtein: Protein;
  }[];
}

export interface SwapKey {
  recipeId: string;
  diet: Diet;
  locale: SwapLocale;
}

export interface SwapStore {
  loadRecipe(recipeId: string): Promise<SwapRecipe | null>;
  loadSwap(key: SwapKey): Promise<StoredSwap | null>;
  // True for the one caller that may generate the pair now (claim_recipe_protein_swap).
  claim(key: SwapKey, sourceHash: string): Promise<boolean>;
  // Saves a claimed pair as ready with its items (save_recipe_protein_swap).
  save(key: SwapKey, swap: ValidatedSwap, sourceHash: string, model: string): Promise<void>;
  // Releases a claimed pair as failed until retryAfter.
  markFailed(key: SwapKey, attempts: number, error: string, retryAfter: Date): Promise<void>;
}
