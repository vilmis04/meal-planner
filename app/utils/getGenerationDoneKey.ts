import type { GenerationMode } from "#shared/utils/mealPlan";

// The message after a generation (E4, E5): plain when every slot was filled the ideal way, otherwise a pointer to the notes.
export function getGenerationDoneKey(
  { emptyCount, compromisedCount }: { emptyCount: number; compromisedCount: number },
  mode: GenerationMode = "fill_empty",
): string {
  const prefix = GENERATION_DONE_PREFIX_BY_MODE[mode];
  return emptyCount + compromisedCount > 0 ? `${prefix}.doneWithNotes` : `${prefix}.done`;
}

const GENERATION_DONE_PREFIX_BY_MODE: Readonly<Record<GenerationMode, string>> = {
  fill_empty: "plan.generate",
  regenerate_unlocked: "plan.regenerate",
};
