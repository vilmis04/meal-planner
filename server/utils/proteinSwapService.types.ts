import type { ProteinSwapView, SwapLocale } from "../../shared/utils/proteinSwap.types";
import type { AiClient } from "./ai/gemini.types";
import type { GenerateSwapOptions } from "./proteinSwapGenerator.types";
import type { createProteinSwapService } from "./proteinSwapService";
import type { SwapStore } from "./proteinSwapStore.types";

export type GetSwapResult =
  | { status: "ready"; swap: ProteinSwapView; generated: boolean }
  | { status: "pending" }
  | { status: "unavailable"; retryAfter: Date }
  | { status: "limited" }
  | { status: "not-needed" }
  | { status: "not-found" };

export interface GetSwapOptions {
  locale?: SwapLocale;
  // Asked just before a cache miss would call the AI; false stops it (the route's per-user limit).
  allowGenerate?: () => boolean;
}

export interface ProteinSwapServiceDeps {
  store: SwapStore;
  // Created lazily so cache hits work even when no AI key is configured.
  ai: () => AiClient;
  now?: () => Date;
  log?: (entry: Record<string, unknown>) => void;
  generateOptions?: GenerateSwapOptions;
}

export type ProteinSwapService = ReturnType<typeof createProteinSwapService>;
