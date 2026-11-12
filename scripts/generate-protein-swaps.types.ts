import type { Diet } from "../shared/utils/diet";
import type { ProteinSwapView, SwapLocale } from "../shared/utils/proteinSwap.types";
import type { GetSwapResult, TranslateSwapResult } from "../server/utils/proteinSwapService.types";

// The columns of recipes the backfill reads.
export interface RecipeRow {
  id: string;
  name: string;
  main_proteins: string[];
  calories_kcal: number | null;
}

export interface Pair {
  recipe: RecipeRow;
  diet: Diet;
}

// One pair's outcome: its swap (read back with every language) and how each translation went (X1c).
export interface PairResult {
  pair: Pair;
  result: GetSwapResult;
  swap: ProteinSwapView | null;
  translations: { locale: SwapLocale; result: TranslateSwapResult }[];
}
