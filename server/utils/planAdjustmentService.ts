/*
 * Interprets a plan adjustment request (I3) with the AI: the plan's days and meal types and the ingredient names give
 * the context, the answer is validated (validatePlanAdjustment()) and cached by the hash of the model and the prompt,
 * so the same request on the same days reaches the AI once. Nothing is applied here: the user confirms the
 * constraints, and POST /api/plans/:id/generate applies them with the rule-based generator.
 */
import { createHash } from "node:crypto";
import { getVisibleMealTypes } from "../../shared/utils/mealPlan";
import {
  PLAN_ADJUSTMENT_PROMPT_VERSION,
  buildPlanAdjustmentPrompt,
  validatePlanAdjustment,
} from "../../shared/utils/planAdjustment";
import { PLAN_ADJUSTMENT_RESPONSE_JSON_SCHEMA } from "../../shared/utils/planAdjustment.schema";
import type { PlanAdjustment, PlanAdjustmentContext } from "../../shared/utils/planAdjustment.types";
import type { AiClient } from "./ai/gemini.types";
import { generateValidatedJson } from "./ai/generateValidatedJson";
import type { GenerateValidatedJsonResult } from "./ai/generateValidatedJson.types";
import { getErrorMessage, writeJsonLog } from "./jsonLog";
import type { PlanAdjustmentService, PlanAdjustmentServiceDeps } from "./planAdjustmentService.types";

export function createPlanAdjustmentService({
  store,
  ai,
  log = writeJsonLog,
  generateOptions,
}: PlanAdjustmentServiceDeps): PlanAdjustmentService {
  return {
    async interpret(planId, text, { allowAiCall }) {
      const plan = await store.loadPlan(planId);
      if (!plan) {
        return { status: "not-found" };
      }

      let client: AiClient;
      try {
        client = ai();
      } catch (error) {
        log({ event: "plan_adjustment.interpret", level: "error", planId, outcome: "no_client", error: getErrorMessage(error) });
        return { status: "unavailable" };
      }

      const context: PlanAdjustmentContext = {
        startDate: plan.startDate,
        dayCount: plan.dayCount,
        mealTypes: getVisibleMealTypes(plan.includeSnacks),
        ingredients: await store.loadIngredients(),
      };
      const promptHash = hashPrompt(client.model, buildPlanAdjustmentPrompt(context, text));
      // The request text is never logged: it is the user's own words.
      const base = { event: "plan_adjustment.interpret", planId, model: client.model };

      const cached = await store.loadInterpretation(promptHash);
      if (cached) {
        log({ ...base, outcome: "cached" });
        return { status: "interpreted", adjustment: cached };
      }
      if (!allowAiCall()) {
        log({ ...base, outcome: "limited" });
        return { status: "limited" };
      }

      const started = Date.now();
      let result: GenerateValidatedJsonResult<PlanAdjustment>;
      try {
        result = await generateValidatedJson(
          client,
          {
            buildPrompt: (previousErrors) => buildPlanAdjustmentPrompt(context, text, previousErrors),
            schema: PLAN_ADJUSTMENT_RESPONSE_JSON_SCHEMA,
            validate: (raw) => {
              const validation = validatePlanAdjustment(context, raw);
              return validation.ok ? { ok: true, value: validation.adjustment } : validation;
            },
          },
          {
            ...generateOptions,
            onAttemptFailed: (attempt, error) => log({ ...base, outcome: "attempt_failed", attempt, error }),
          },
        );
      } catch (error) {
        result = { ok: false, error: getErrorMessage(error), attempts: 1 };
      }

      if (!result.ok) {
        log({ ...base, level: "error", outcome: "failed", attempts: result.attempts, error: result.error, ms: Date.now() - started });
        return { status: "unavailable" };
      }

      // The cache only saves AI calls: a failed write still gives the user their answer.
      await store
        .saveInterpretation(promptHash, client.model, result.value)
        .catch((error: unknown) => log({ ...base, level: "error", outcome: "cache_failed", error: getErrorMessage(error) }));
      const { constraints, unsupported } = result.value;
      log({
        ...base,
        outcome: "interpreted",
        attempts: result.attempts,
        ms: Date.now() - started,
        excludedProteinCount: constraints.excludedProteins.length,
        excludedIngredientCount: constraints.excludedIngredients.length,
        quickMealCount: constraints.quickMeals.length,
        unsupportedCount: unsupported.length,
      });
      return { status: "interpreted", adjustment: result.value };
    },
  };
}

// The cache key: the prompt holds the request and all of its context, so any change to either is a new key.
const hashPrompt = (model: string, prompt: string): string =>
  createHash("sha256").update(`${PLAN_ADJUSTMENT_PROMPT_VERSION}\n${model}\n${prompt}`).digest("hex");
