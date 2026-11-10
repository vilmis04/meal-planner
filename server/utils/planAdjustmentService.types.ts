import type { PlanAdjustment } from "../../shared/utils/planAdjustment.types";
import type { AiClient } from "./ai/gemini.types";
import type { GenerateValidatedJsonOptions } from "./ai/generateValidatedJson.types";
import type { PlanAdjustmentStore } from "./planAdjustmentStore.types";

export interface PlanAdjustmentServiceDeps {
  store: PlanAdjustmentStore;
  // Made only when the AI is really needed (a cache miss); throws when it is not configured.
  ai: () => AiClient;
  log?: (entry: Record<string, unknown>) => void;
  generateOptions?: GenerateValidatedJsonOptions;
}

export type InterpretAdjustmentResult =
  | { status: "interpreted"; adjustment: PlanAdjustment }
  // No such plan, or the user cannot open it.
  | { status: "not-found" }
  // The user asked the AI too often; cached answers are still given.
  | { status: "limited" }
  // The AI is not configured, failed, or kept answering outside the rules.
  | { status: "unavailable" };

export interface PlanAdjustmentService {
  // The text must already be normalized (normalizeAdjustmentText()). allowAiCall is asked once, on a cache miss.
  interpret(planId: string, text: string, options: { allowAiCall: () => boolean }): Promise<InterpretAdjustmentResult>;
}
