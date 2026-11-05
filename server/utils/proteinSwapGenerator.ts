/*
 * One protein swap from the AI, with retries: a retryable failure (rate limit, server error, timeout) waits
 * and tries again; an answer that fails validation is asked again with its errors. No database access, so it
 * is tested with a fake client.
 */
import { buildSwapPrompt, validateSwap } from "../../shared/utils/proteinSwap";
import { SWAP_RESPONSE_JSON_SCHEMA } from "../../shared/utils/proteinSwap.schema";
import type { SwapRecipe } from "../../shared/utils/proteinSwap.types";
import type { Diet } from "../../shared/utils/diet";
import { AiError } from "./ai/gemini";
import type { AiClient } from "./ai/gemini.types";
import type { GenerateSwapOptions, GenerateSwapResult } from "./proteinSwapGenerator.types";

export const SWAP_ATTEMPTS = 3;
const BACKOFF_MS = [1000, 2000];

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function generateSwap(
  ai: AiClient,
  recipe: SwapRecipe,
  diet: Diet,
  options: GenerateSwapOptions = {},
): Promise<GenerateSwapResult> {
  const attempts = options.attempts ?? SWAP_ATTEMPTS;
  const sleep = options.sleep ?? defaultSleep;
  let previousErrors: string[] = [];
  let lastError = "no attempt made";

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const raw = await ai.generateJson({
        prompt: buildSwapPrompt(recipe, diet, previousErrors),
        schema: SWAP_RESPONSE_JSON_SCHEMA,
      });
      const validation = validateSwap(recipe, diet, raw);
      if (validation.ok) {
        return { ok: true, swap: validation.swap, attempts: attempt };
      }
      previousErrors = validation.errors;
      lastError = `invalid answer: ${validation.errors.join("; ")}`;
    } catch (error) {
      if (error instanceof AiError && !error.retryable) {
        options.onAttemptFailed?.(attempt, error.message);
        return { ok: false, error: error.message, attempts: attempt };
      }
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < attempts) {
        await sleep(BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)]!);
      }
    }
    options.onAttemptFailed?.(attempt, lastError);
  }

  return { ok: false, error: lastError, attempts };
}
