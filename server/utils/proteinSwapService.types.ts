import type { ProteinSwapView } from "../../shared/utils/proteinSwap.types";
import type { AiClient } from "./ai/gemini.types";
import type { GenerateSwapOptions } from "./proteinSwapGenerator.types";
import type { createProteinSwapReader } from "./proteinSwapService";
import type { SwapStore } from "./proteinSwapStore.types";

export type GetSwapResult =
  | { status: "ready"; swap: ProteinSwapView; generated: boolean }
  | { status: "pending" }
  | { status: "unavailable"; retryAfter: Date }
  | { status: "not-needed" }
  | { status: "not-found" };

// What a viewer gets (X1c): "missing" is a cache miss, which nothing generates at view time.
export type ReadSwapResult =
  | { status: "ready"; swap: ProteinSwapView }
  | { status: "missing" }
  | { status: "not-needed" }
  | { status: "not-found" };

// "no-swap": the pair has no ready swap from the current ingredients to translate (generate it first).
export type TranslateSwapResult =
  | { status: "translated" }
  | { status: "present" }
  | { status: "no-swap" }
  | { status: "failed"; error: string };

export interface ProteinSwapServiceDeps {
  store: SwapStore;
  // Created lazily so cache hits work even when no AI key is configured.
  ai: () => AiClient;
  now?: () => Date;
  log?: (entry: Record<string, unknown>) => void;
  generateOptions?: GenerateSwapOptions;
}

export type ProteinSwapReader = ReturnType<typeof createProteinSwapReader>;
