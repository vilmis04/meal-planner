// One ingredient line as recipe detail lists it.
export interface IngredientLine {
  position: number;
  item: string;
  amount: number | null;
  unit: string | null;
}

// A replacement from a ready protein swap (ProteinSwapView["items"][number] carries these fields).
export interface SwapReplacement {
  position: number;
  original: Omit<IngredientLine, "position">;
  item: string;
  amount: number | null;
  unit: string | null;
}

// An ingredient line after the swap: swapped lines carry what they replaced.
export interface SwappedIngredientLine extends IngredientLine {
  swapped: boolean;
  original: Omit<IngredientLine, "position"> | null;
}
