/*
 * One protein swap from the AI, with retries (generateValidatedJson()): a retryable failure waits and tries again; an
 * answer that fails validation is asked again with its errors. No database access, so it is tested with a fake client.
 */
import { buildSwapPrompt, validateSwap } from "../../shared/utils/proteinSwap";
import { SWAP_RESPONSE_JSON_SCHEMA } from "../../shared/utils/proteinSwap.schema";
import type { SwapRecipe } from "../../shared/utils/proteinSwap.types";
import type { Diet } from "../../shared/utils/diet";
import type { AiClient } from "./ai/gemini.types";
import { generateValidatedJson } from "./ai/generateValidatedJson";
import type { GenerateSwapOptions, GenerateSwapResult } from "./proteinSwapGenerator.types";

export async function generateSwap(
  ai: AiClient,
  recipe: SwapRecipe,
  diet: Diet,
  options: GenerateSwapOptions = {},
): Promise<GenerateSwapResult> {
  const result = await generateValidatedJson(
    ai,
    {
      buildPrompt: (previousErrors) => buildSwapPrompt(recipe, diet, previousErrors),
      schema: SWAP_RESPONSE_JSON_SCHEMA,
      validate: (raw) => {
        const validation = validateSwap(recipe, diet, raw);
        return validation.ok ? { ok: true, value: validation.swap } : validation;
      },
    },
    options,
  );
  return result.ok ? { ok: true, swap: result.value, attempts: result.attempts } : result;
}
