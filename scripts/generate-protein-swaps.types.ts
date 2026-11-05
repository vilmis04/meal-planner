import type { Diet } from "../shared/utils/diet";

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
