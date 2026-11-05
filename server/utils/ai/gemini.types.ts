export interface AiClient {
  readonly model: string;
  // Returns the model's JSON answer, parsed. Throws AiError.
  generateJson(request: { prompt: string; schema: unknown }): Promise<unknown>;
}

export interface GeminiOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

// The part of a generateContent response the client reads.
export interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
}
