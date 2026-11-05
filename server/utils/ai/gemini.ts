/*
 * The AI provider, behind a small interface so it can be swapped (architecture decision 7) and faked in tests.
 * Server-only: the key comes from private runtime config (or the backfill script's environment) and is sent
 * in a header, never in a URL or a response. Imports are explicit so the backfill script can run it too.
 */
import type { AiClient, GeminiOptions, GeminiResponse } from "./gemini.types";

export class AiError extends Error {
  constructor(
    message: string,
    // Worth trying again: rate limit, server error, timeout, network failure, unreadable answer.
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_TIMEOUT_MS = 30_000;

export function createGeminiClient(options: GeminiOptions): AiClient {
  if (!options.apiKey) {
    throw new Error("The Gemini API key is not set (NUXT_GEMINI_API_KEY)");
  }
  const doFetch = options.fetch ?? fetch;
  const baseUrl = (options.baseUrl || GEMINI_BASE_URL).replace(/\/+$/, "");
  const url = `${baseUrl}/models/${encodeURIComponent(options.model)}:generateContent`;

  return {
    model: options.model,
    async generateJson({ prompt, schema }) {
      let response: Response;
      try {
        response = await doFetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": options.apiKey },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 },
          }),
          signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        });
      } catch (error) {
        throw new AiError(`Gemini request failed: ${error instanceof Error ? error.message : String(error)}`, true);
      }

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        throw new AiError(`Gemini answered HTTP ${response.status}`, retryable);
      }

      let body: GeminiResponse;
      try {
        body = (await response.json()) as GeminiResponse;
      } catch {
        throw new AiError("Gemini answered with a body that is not JSON", true);
      }

      const candidate = body.candidates?.[0];
      const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
      if (!text) {
        throw new AiError(`Gemini returned no text (finish reason ${candidate?.finishReason ?? "unknown"})`, true);
      }
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new AiError("Gemini returned text that is not valid JSON", true);
      }
    },
  };
}
