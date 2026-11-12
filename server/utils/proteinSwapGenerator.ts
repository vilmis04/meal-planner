/*
 * One protein swap from the AI, and its translation into another language (X1c), with retries
 * (generateValidatedJson()): a retryable failure waits and tries again; an answer that fails validation is asked again
 * with its errors. No database access, so it is tested with a fake client.
 */
import { buildSwapPrompt, validateSwap } from "../../shared/utils/proteinSwap";
import { SWAP_RESPONSE_JSON_SCHEMA, SWAP_TRANSLATION_RESPONSE_JSON_SCHEMA } from "../../shared/utils/proteinSwap.schema";
import type { SwapLocale, SwapRecipe, SwapTranslationSource } from "../../shared/utils/proteinSwap.types";
import { buildSwapTranslationPrompt, validateSwapTranslation } from "../../shared/utils/proteinSwapTranslation";
import type { Diet } from "../../shared/utils/diet";
import type { AiClient } from "./ai/gemini.types";
import { generateValidatedJson } from "./ai/generateValidatedJson";
import type {
  GenerateSwapOptions,
  GenerateSwapResult,
  GenerateSwapTranslationResult,
} from "./proteinSwapGenerator.types";

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

// One swap's translation into another language (X1c), with the same retries.
export async function generateSwapTranslation(
  ai: AiClient,
  source: SwapTranslationSource,
  locale: SwapLocale,
  options: GenerateSwapOptions = {},
): Promise<GenerateSwapTranslationResult> {
  const result = await generateValidatedJson(
    ai,
    {
      buildPrompt: (previousErrors) => buildSwapTranslationPrompt(source, locale, previousErrors),
      schema: SWAP_TRANSLATION_RESPONSE_JSON_SCHEMA,
      validate: (raw) => {
        const validation = validateSwapTranslation(source, locale, raw);
        return validation.ok ? { ok: true, value: validation.translation } : validation;
      },
    },
    options,
  );
  return result.ok ? { ok: true, translation: result.value, attempts: result.attempts } : result;
}
