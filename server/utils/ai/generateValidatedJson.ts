/*
 * One structured AI answer that passes validation, with retries: a retryable failure (rate limit, server error,
 * timeout) waits and tries again; an answer that fails validation is asked again with its errors. Shared by the
 * protein swaps (D2) and the plan adjustments (I3). No database access, so it is tested with a fake client.
 */
import { AiError } from "./gemini";
import type { AiClient } from "./gemini.types";
import type { GenerateValidatedJsonOptions, GenerateValidatedJsonResult, ValidatedJsonRequest } from "./generateValidatedJson.types";

const AI_ATTEMPTS = 3;
const BACKOFF_MS = [1000, 2000];

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function generateValidatedJson<Value>(
  ai: AiClient,
  request: ValidatedJsonRequest<Value>,
  options: GenerateValidatedJsonOptions = {},
): Promise<GenerateValidatedJsonResult<Value>> {
  const attempts = options.attempts ?? AI_ATTEMPTS;
  const sleep = options.sleep ?? defaultSleep;
  let previousErrors: string[] = [];
  let lastError = "no attempt made";

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const raw = await ai.generateJson({ prompt: request.buildPrompt(previousErrors), schema: request.schema });
      const validation = request.validate(raw);
      if (validation.ok) {
        return { ok: true, value: validation.value, attempts: attempt };
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
