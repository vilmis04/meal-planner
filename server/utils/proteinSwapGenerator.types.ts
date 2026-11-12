import type { SwapTranslation, ValidatedSwap } from "../../shared/utils/proteinSwap.types";
import type { GenerateValidatedJsonOptions } from "./ai/generateValidatedJson.types";

export type GenerateSwapResult =
  | { ok: true; swap: ValidatedSwap; attempts: number }
  | { ok: false; error: string; attempts: number };

export type GenerateSwapTranslationResult =
  | { ok: true; translation: SwapTranslation; attempts: number }
  | { ok: false; error: string; attempts: number };

export type GenerateSwapOptions = GenerateValidatedJsonOptions;
