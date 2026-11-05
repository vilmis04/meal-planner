import type { ValidatedSwap } from "../../shared/utils/proteinSwap.types";

export type GenerateSwapResult =
  | { ok: true; swap: ValidatedSwap; attempts: number }
  | { ok: false; error: string; attempts: number };

export interface GenerateSwapOptions {
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
  onAttemptFailed?: (attempt: number, error: string) => void;
}
