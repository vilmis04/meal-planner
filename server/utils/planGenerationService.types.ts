import type { PlanGenerationStore } from "./planGenerationStore.types";

export interface PlanGenerationDeps {
  store: PlanGenerationStore;
  // A fresh seed for a generation that was not given one.
  createSeed: () => number;
  log?: (entry: Record<string, unknown>) => void;
}

// What the plan page needs to tell the user; the slots themselves are read back from the plan.
export interface GenerationSummary {
  filledCount: number;
  // Left empty, each with a note saying why.
  emptyCount: number;
  // Filled, but with a note: a resting or repeated recipe, or a workday without a batch.
  compromisedCount: number;
  seed: number;
}

export type GeneratePlanResult =
  | ({ status: "generated" } & GenerationSummary)
  | { status: "not-found" }
  // No one eats from the plan, so there are no diets or preferences to plan for.
  | { status: "no-participants" }
  // "fill_empty": every slot that can be filled already holds a recipe.
  | { status: "nothing-to-fill" }
  // "regenerate_unlocked": every slot the plan shows is locked.
  | { status: "all-locked" }
  // Someone changed or locked a slot while the plan was generated; nothing was written.
  | { status: "plan-changed" };

export type SwapSlotResult =
  | ({ status: "swapped" } & GenerationSummary)
  // No such plan or slot, or the user cannot open the plan.
  | { status: "not-found" }
  | { status: "no-participants" }
  // A locked slot keeps its recipe; it is unlocked first.
  | { status: "slot-locked" }
  // No other recipe obeys the rules for this slot (a skipped snack slot has none either); nothing was written.
  | { status: "no-alternative" }
  | { status: "plan-changed" };
