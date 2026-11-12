/*
 * Protein swaps (D2), stored once and read many times. Viewing never calls the AI (X1c):
 *
 *   createProteinSwapReader()   what the API route uses: a stored, ready swap made from the recipe's current
 *                               ingredients, in every language it is stored in, or "missing". No AI client at all.
 *   createProteinSwapService()  what `npm run swaps:generate` uses: getOrCreateSwap() generates a missing or stale
 *                               swap in Lithuanian, and translateSwap() translates a ready one into another language,
 *                               each once (stored ones are read, not asked for again).
 *
 * getOrCreateSwap()'s cache rule:
 *   stored, ready and made from the current ingredients  -> return it, no AI call
 *   another run is generating it                         -> "pending"
 *   failed recently                                      -> "unavailable" until retry_after
 *   otherwise                                            -> claim it (one winner), ask the AI, save, return
 *
 * Imports are explicit so the backfill script can run it too.
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
import type {
  ProteinSwapView,
  SwapLocale,
  SwapRecipe,
  SwapTranslationSource,
  ValidatedSwap,
} from "../../shared/utils/proteinSwap.types";
import type { AiClient } from "./ai/gemini.types";
import { generateSwap, generateSwapTranslation } from "./proteinSwapGenerator";
import type { GenerateSwapResult, GenerateSwapTranslationResult } from "./proteinSwapGenerator.types";
import type {
  GetSwapResult,
  ProteinSwapServiceDeps,
  ReadSwapResult,
  TranslateSwapResult,
} from "./proteinSwapService.types";
import type { StoredSwap, SwapKey, SwapStore } from "./proteinSwapStore.types";

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
    notes: stored.translations,
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
            texts: item.texts,
            amount: item.amount,
            unit: item.unit,
            replacementProtein: item.replacementProtein,
          },
        ];
      })
      .sort((a, b) => a.position - b.position),
  };
}

// A swap just generated has its Lithuanian rows only (the database's mirror writes them as it is saved).
function storedFromGenerated(swap: ValidatedSwap, locale: SwapLocale, generatedAt: Date): StoredSwap {
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
    translations: [{ locale, note: swap.note }],
    items: swap.items.map((item) => ({ ...item, texts: [{ locale, item: item.item }] })),
  };
}

const isFresh = (stored: StoredSwap | null, sourceHash: string) =>
  stored?.status === "ready" && stored.sourceHash === sourceHash && stored.promptVersion === PROMPT_VERSION;

const defaultLog = (entry: Record<string, unknown>) => console.info(JSON.stringify(entry));

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const keyFor = (recipeId: string, diet: Diet): SwapKey => ({ recipeId, diet, locale: DEFAULT_SWAP_LOCALE });

// The swap a viewer sees (GET /api/recipes/:id/swaps/:diet). A cache miss is "missing": the script makes it.
export function createProteinSwapReader({ store }: { store: SwapStore }) {
  async function readSwap(recipeId: string, diet: Diet): Promise<ReadSwapResult> {
    const recipe = await store.loadRecipe(recipeId);
    if (!recipe) return { status: "not-found" };
    if (isRecipeCompatible(diet, recipe.mainProteins)) return { status: "not-needed" };

    const key = keyFor(recipeId, diet);
    const stored = await store.loadSwap(key);
    if (!isFresh(stored, recipeSourceHash(recipe))) return { status: "missing" };
    return { status: "ready", swap: viewFromStored(recipe, key, stored!) };
  }

  return { readSwap };
}

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

  async function getOrCreateSwap(recipeId: string, diet: Diet): Promise<GetSwapResult> {
    const key = keyFor(recipeId, diet);
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

    if (!(await store.claim(key, sourceHash))) {
      // Lost the race: another run is generating it, or has just finished.
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
    const view = viewFromStored(recipe, key, storedFromGenerated(result.swap, key.locale, now()));
    return { status: "ready", swap: view, generated: true };
  }

  /*
   * Translates the stored, ready swap of a pair into one language, once: a swap already translated into it is left
   * alone. A failure is logged and stored nowhere, so the next run tries again (the swap shows in Lithuanian till then).
   */
  async function translateSwap(recipeId: string, diet: Diet, locale: SwapLocale): Promise<TranslateSwapResult> {
    const key = keyFor(recipeId, diet);
    const recipe = await store.loadRecipe(recipeId);
    if (!recipe) return { status: "no-swap" };
    const stored = await store.loadSwap(key);
    if (!isFresh(stored, recipeSourceHash(recipe))) return { status: "no-swap" };
    if (stored!.translations.some((translation) => translation.locale === locale)) return { status: "present" };

    const lines = await store.loadRecipeLineTranslations(recipeId, locale);
    const byId = new Map(recipe.ingredients.map((ingredient) => [ingredient.id, ingredient]));
    const source: SwapTranslationSource = {
      recipeName: recipe.name,
      diet,
      note: stored!.note,
      items: stored!.items.flatMap((item) => {
        const original = byId.get(item.recipeIngredientId);
        if (!original) return [];
        return [
          {
            recipeIngredientId: item.recipeIngredientId,
            position: original.position,
            original: original.item,
            originalTranslated: lines.get(item.recipeIngredientId) ?? null,
            item: item.item,
            replacementProtein: item.replacementProtein,
          },
        ];
      }),
    };

    let ai: AiClient;
    try {
      ai = deps.ai();
    } catch (error) {
      log({ event: "protein_swap.translate", ...key, to: locale, outcome: "failed", error: messageOf(error) });
      return { status: "failed", error: messageOf(error) };
    }

    const started = Date.now();
    const base = { event: "protein_swap.translate", ...key, to: locale, model: ai.model };
    let result: GenerateSwapTranslationResult;
    try {
      result = await generateSwapTranslation(ai, source, locale, {
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
      log({ ...base, outcome: "failed", attempts: result.attempts, error: result.error, ms: Date.now() - started });
      return { status: "failed", error: result.error };
    }

    await store.saveTranslation(key, result.translation);
    log({ ...base, outcome: "translated", attempts: result.attempts, ms: Date.now() - started });
    return { status: "translated" };
  }

  return { getOrCreateSwap, translateSwap };
}
