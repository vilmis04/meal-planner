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
  // Every slot that can be filled already holds a recipe.
  | { status: "nothing-to-fill" }
  // Someone filled a slot while the plan was generated; nothing was written.
  | { status: "plan-changed" };
