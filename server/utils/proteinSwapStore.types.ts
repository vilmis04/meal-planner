import type { Diet, Protein } from "../../shared/utils/diet";
import type {
  SwapItemText,
  SwapLocale,
  SwapNoteText,
  SwapRecipe,
  SwapStatus,
  SwapTranslation,
  ValidatedSwap,
} from "../../shared/utils/proteinSwap.types";

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
  // The note in each language the swap is stored in (X1c): a row per language it is translated into, 'lt' included.
  translations: SwapNoteText[];
  items: {
    recipeIngredientId: string;
    item: string;
    texts: SwapItemText[];
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
  // The recipe's lines in another language by ingredient id (X1c), as context for translating its swap.
  loadRecipeLineTranslations(recipeId: string, locale: SwapLocale): Promise<Map<string, string>>;
  loadSwap(key: SwapKey): Promise<StoredSwap | null>;
  // True for the one caller that may generate the pair now (claim_recipe_protein_swap).
  claim(key: SwapKey, sourceHash: string): Promise<boolean>;
  // Saves a claimed pair as ready with its items (save_recipe_protein_swap).
  save(key: SwapKey, swap: ValidatedSwap, sourceHash: string, model: string): Promise<void>;
  // Stores a ready swap's translation into one language (save_recipe_protein_swap_translation()).
  saveTranslation(key: SwapKey, translation: SwapTranslation): Promise<void>;
  // Releases a claimed pair as failed until retryAfter.
  markFailed(key: SwapKey, attempts: number, error: string, retryAfter: Date): Promise<void>;
}
