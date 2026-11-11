export interface ValidatedJsonRequest<Value> {
  // The prompt, with the errors of the previous answer (none on the first attempt).
  buildPrompt: (previousErrors: readonly string[]) => string;
  // The structured output schema the provider is given.
  schema: unknown;
  validate: (raw: unknown) => { ok: true; value: Value } | { ok: false; errors: string[] };
}

export type GenerateValidatedJsonResult<Value> =
  | { ok: true; value: Value; attempts: number }
  | { ok: false; error: string; attempts: number };

export interface GenerateValidatedJsonOptions {
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
  onAttemptFailed?: (attempt: number, error: string) => void;
}
