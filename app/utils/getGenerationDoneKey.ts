// The message after a generation (E4): plain when every slot was filled the ideal way, otherwise a pointer to the notes.
export function getGenerationDoneKey({ emptyCount, compromisedCount }: { emptyCount: number; compromisedCount: number }): string {
  return emptyCount + compromisedCount > 0 ? "plan.generate.doneWithNotes" : "plan.generate.done";
}
