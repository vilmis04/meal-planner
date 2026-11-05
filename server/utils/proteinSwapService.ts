/*
 * Get a protein swap, generating it on demand (D2). The one entry point for the API route, the plan
 * generator (E4) and the backfill script, so the cache rule lives in one place:
 *
 *   stored, ready and made from the current ingredients  -> return it, no AI call
 *   another request is generating it                     -> "pending", ask again shortly
 *   failed recently                                      -> "unavailable" until retry_after
 *   otherwise                                            -> claim it (one winner), ask the AI, save, return
 *
 * Callers check who is asking before calling. Imports are explicit so the backfill script can run it too.
 */
import { createHash } from "node:crypto";
import { isRecipeCompatible } from "../../shared/utils/diet";
import type { Diet } from "../../shared/utils/diet";
import {
  DEFAULT_SWAP_LOCALE,
  PROMPT_VERSION,
  nextRetryAfter,
  swapCacheDecision,
} from "../../shared/utils/proteinSwap";
import type { ProteinSwapView, SwapRecipe, ValidatedSwap } from "../../shared/utils/proteinSwap.types";
import type { AiClient } from "./ai/gemini.types";
import { generateSwap } from "./proteinSwapGenerator";
import type { GenerateSwapResult } from "./proteinSwapGenerator.types";
import type { GetSwapOptions, GetSwapResult, ProteinSwapServiceDeps } from "./proteinSwapService.types";
import type { StoredSwap, SwapKey } from "./proteinSwapStore.types";

// Changes when the recipe's ingredients or main proteins change, which makes a stored swap stale.
export function recipeSourceHash(recipe: SwapRecipe): string {
  const source = {
    mainProteins: [...recipe.mainProteins].sort(),
    ingredients: recipe.ingredients.map((i) => [i.id, i.position, i.item, i.amount, i.unit]),
  };
  return createHash("sha256").update(JSON.stringify(source)).digest("hex");
}

function viewFromStored(recipe: SwapRecipe, key: SwapKey, stored: StoredSwap): ProteinSwapView {
  const byId = new Map(recipe.ingredients.map((ingredient) => [ingredient.id, ingredient]));
  return {
    recipeId: recipe.id,
    diet: key.diet,
    locale: key.locale,
    note: stored.note,
    nutrition:
      stored.caloriesKcal === null
        ? null
        : {
            caloriesKcal: stored.caloriesKcal,
            carbohydrates: stored.carbohydrates,
            protein: stored.protein,
            fat: stored.fat,
          },
    nutritionApproximate: true,
    generatedAt: stored.generatedAt?.toISOString() ?? "",
    items: stored.items
      .flatMap((item) => {
        const original = byId.get(item.recipeIngredientId);
        if (!original) return [];
        return [
          {
            position: original.position,
            original: { item: original.item, amount: original.amount, unit: original.unit },
            item: item.item,
            amount: item.amount,
            unit: item.unit,
            replacementProtein: item.replacementProtein,
          },
        ];
      })
      .sort((a, b) => a.position - b.position),
  };
}

function storedFromGenerated(swap: ValidatedSwap, generatedAt: Date): StoredSwap {
  return {
    status: "ready",
    claimedAt: null,
    retryAfter: null,
    attempts: 0,
    sourceHash: null,
    promptVersion: PROMPT_VERSION,
    note: swap.note,
    caloriesKcal: swap.nutrition?.caloriesKcal ?? null,
    carbohydrates: swap.nutrition?.carbohydrates ?? null,
    protein: swap.nutrition?.protein ?? null,
    fat: swap.nutrition?.fat ?? null,
    generatedAt,
    items: swap.items,
  };
}

const isFresh = (stored: StoredSwap | null, sourceHash: string) =>
  stored?.status === "ready" && stored.sourceHash === sourceHash && stored.promptVersion === PROMPT_VERSION;

const defaultLog = (entry: Record<string, unknown>) => console.info(JSON.stringify(entry));

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function createProteinSwapService(deps: ProteinSwapServiceDeps) {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? defaultLog;
  const { store } = deps;

  async function fail(key: SwapKey, failures: number, error: string, extra: Record<string, unknown>) {
    const retryAfter = nextRetryAfter(failures, now());
    await store.markFailed(key, failures, error, retryAfter);
    log({ event: "protein_swap.generate", ...key, outcome: "failed", failures, error, retryAfter, ...extra });
    return { status: "unavailable" as const, retryAfter };
  }

  async function getOrCreateSwap(recipeId: string, diet: Diet, options: GetSwapOptions = {}): Promise<GetSwapResult> {
    const key: SwapKey = { recipeId, diet, locale: options.locale ?? DEFAULT_SWAP_LOCALE };
    const recipe = await store.loadRecipe(recipeId);
    if (!recipe) return { status: "not-found" };
    if (isRecipeCompatible(diet, recipe.mainProteins)) return { status: "not-needed" };

    const sourceHash = recipeSourceHash(recipe);
    const stored = await store.loadSwap(key);
    const decision = swapCacheDecision(stored, { sourceHash, promptVersion: PROMPT_VERSION }, now());

    if (decision.action === "hit") {
      return { status: "ready", swap: viewFromStored(recipe, key, stored!), generated: false };
    }
    if (decision.action === "wait") return { status: "pending" };
    if (decision.action === "unavailable") return { status: "unavailable", retryAfter: decision.retryAfter };
    if (options.allowGenerate && !options.allowGenerate()) return { status: "limited" };

    if (!(await store.claim(key, sourceHash))) {
      // Lost the race: another request is generating it, or has just finished.
      const latest = await store.loadSwap(key);
      if (isFresh(latest, sourceHash)) {
        return { status: "ready", swap: viewFromStored(recipe, key, latest!), generated: false };
      }
      if (latest?.status === "failed" && latest.retryAfter) {
        return { status: "unavailable", retryAfter: latest.retryAfter };
      }
      return { status: "pending" };
    }

    const failures = (stored?.attempts ?? 0) + 1;
    let ai: AiClient;
    try {
      ai = deps.ai();
    } catch (error) {
      // No usable AI client (e.g. no key): release the claim as failed rather than leave it pending.
      return fail(key, failures, messageOf(error), {});
    }

    const started = Date.now();
    const base = { event: "protein_swap.generate", ...key, model: ai.model };
    let result: GenerateSwapResult;
    try {
      result = await generateSwap(ai, recipe, diet, {
        ...deps.generateOptions,
        onAttemptFailed: (attempt, error) => {
          log({ ...base, outcome: "attempt_failed", attempt, error });
          deps.generateOptions?.onAttemptFailed?.(attempt, error);
        },
      });
    } catch (error) {
      result = { ok: false, error: messageOf(error), attempts: 1 };
    }

    if (!result.ok) {
      return fail(key, failures, result.error, { model: ai.model, attempts: result.attempts, ms: Date.now() - started });
    }

    await store.save(key, result.swap, sourceHash, ai.model);
    log({ ...base, outcome: "ready", attempts: result.attempts, items: result.swap.items.length, ms: Date.now() - started });
    const view = viewFromStored(recipe, key, storedFromGenerated(result.swap, now()));
    return { status: "ready", swap: view, generated: true };
  }

  return { getOrCreateSwap };
}
