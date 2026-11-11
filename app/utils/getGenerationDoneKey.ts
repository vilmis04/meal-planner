import type { GenerationMode } from "#shared/utils/mealPlan";
import type { GenerationCounts } from "~/types/mealPlan.types";

// The message after a generation (E4, E5): plain when every slot was filled the ideal way, otherwise a pointer to the notes.
export function getGenerationDoneKey(counts: GenerationCounts, mode: GenerationMode = "fill_empty"): string {
  return withNotes(GENERATION_DONE_PREFIX_BY_MODE[mode], counts);
}

// The message after applying a plan adjustment (I3), the same way.
export function getAdjustmentDoneKey(counts: GenerationCounts): string {
  return withNotes("plan.adjust", counts);
}

const GENERATION_DONE_PREFIX_BY_MODE: Readonly<Record<GenerationMode, string>> = {
  fill_empty: "plan.generate",
  regenerate_unlocked: "plan.regenerate",
};

const withNotes = (prefix: string, { emptyCount, compromisedCount }: GenerationCounts): string =>
  emptyCount + compromisedCount > 0 ? `${prefix}.doneWithNotes` : `${prefix}.done`;
