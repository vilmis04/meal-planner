import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLAIM_TTL_MS, PROMPT_VERSION } from "../../shared/utils/proteinSwap";
import type { SwapRecipe, SwapTranslation } from "../../shared/utils/proteinSwap.types";
import { AiError } from "./ai/gemini";
import type { AiClient } from "./ai/gemini.types";
import { createProteinSwapReader, createProteinSwapService, recipeSourceHash } from "./proteinSwapService";
import type { StoredSwap, SwapKey, SwapStore } from "./proteinSwapStore.types";

/*
 * An in-memory store with the same claim rules as claim_recipe_protein_swap(), so the service's cache
 * behaviour is tested without a database. The SQL itself is tested in supabase/tests.
 */
function memoryStore(recipes: SwapRecipe[], clock: () => Date) {
  const rows = new Map<string, StoredSwap>();
  const lineTranslations = new Map<string, string>([["i1", "Lean beef"]]);
  const id = (key: SwapKey) => `${key.recipeId}/${key.diet}/${key.locale}`;
  const store: SwapStore = {
    async loadRecipe(recipeId) {
      return recipes.find((recipe) => recipe.id === recipeId) ?? null;
    },
    async loadRecipeLineTranslations(recipeId) {
      const recipe = recipes.find((candidate) => candidate.id === recipeId);
      const ids = new Set(recipe?.ingredients.map((ingredient) => ingredient.id));
      return new Map([...lineTranslations].filter(([id]) => ids.has(id)));
    },
    async loadSwap(key) {
      const row = rows.get(id(key));
      return row ? structuredClone(row) : null;
    },
    async claim(key, sourceHash) {
      const row = rows.get(id(key));
      const now = clock().getTime();
      const claimable =
        !row ||
        row.status === "rejected" ||
        (row.status === "failed" && row.retryAfter!.getTime() <= now) ||
        (row.status === "pending" && row.claimedAt!.getTime() < now - CLAIM_TTL_MS) ||
        (row.status === "ready" && (row.sourceHash !== sourceHash || row.promptVersion !== PROMPT_VERSION));
      if (!claimable) return false;
      rows.set(id(key), {
        ...(row ?? emptyRow()),
        status: "pending",
        claimedAt: clock(),
      });
      return true;
    },
    async save(key, swap, sourceHash, model) {
      const row = rows.get(id(key));
      if (row?.status !== "pending") throw new Error("not_claimed");
      rows.set(id(key), {
        ...row,
        status: "ready",
        claimedAt: null,
        attempts: 0,
        retryAfter: null,
        sourceHash,
        promptVersion: PROMPT_VERSION,
        note: swap.note,
        caloriesKcal: swap.nutrition?.caloriesKcal ?? null,
        carbohydrates: swap.nutrition?.carbohydrates ?? null,
        protein: swap.nutrition?.protein ?? null,
        fat: swap.nutrition?.fat ?? null,
        generatedAt: clock(),
        // As save_recipe_protein_swap(): other languages go, the Lithuanian rows follow the new text.
        translations: [{ locale: key.locale, note: swap.note }],
        items: swap.items.map(({ recipeIngredientId, item, amount, unit, replacementProtein }) => ({
          recipeIngredientId,
          item,
          texts: [{ locale: key.locale, item }],
          amount,
          unit,
          replacementProtein,
        })),
      });
      models.push(model);
    },
    async saveTranslation(key, translation) {
      const row = rows.get(id(key));
      if (row?.status !== "ready") throw new Error("not_ready");
      row.translations = [
        ...row.translations.filter((existing) => existing.locale !== translation.locale),
        { locale: translation.locale, note: translation.note },
      ];
      for (const item of row.items) {
        const translated = translation.items.find((candidate) => candidate.recipeIngredientId === item.recipeIngredientId);
        if (translated?.sourceItem !== item.item) throw new Error("swap_changed");
        item.texts = [...item.texts.filter((text) => text.locale !== translation.locale), { locale: translation.locale, item: translated.item }];
      }
      saved.push(structuredClone(translation));
    },
    async markFailed(key, attempts, _error, retryAfter) {
      const row = rows.get(id(key));
      if (row?.status !== "pending") return;
      rows.set(id(key), { ...row, status: "failed", claimedAt: null, attempts, retryAfter });
    },
  };
  const models: string[] = [];
  const saved: SwapTranslation[] = [];
  return { store, rows, models, saved };
}

function emptyRow(): StoredSwap {
  return {
    status: "pending",
    claimedAt: null,
    retryAfter: null,
    attempts: 0,
    sourceHash: null,
    promptVersion: null,
    note: null,
    caloriesKcal: null,
    carbohydrates: null,
    protein: null,
    fat: null,
    generatedAt: null,
    translations: [],
    items: [],
  };
}

const chili: SwapRecipe = {
  id: "beef-chili",
  name: "Jautienos čili troškinys",
  mainProteins: ["beef"],
  ingredients: [
    { id: "i1", position: 1, item: "Liesa jautienos mėsa", amount: 120, unit: "g" },
    { id: "i2", position: 2, item: "Pupelės", amount: 80, unit: "g" },
  ],
  nutrition: { caloriesKcal: 500, carbohydrates: 40, protein: 38, fat: 15 },
};
const porridge: SwapRecipe = {
  id: "porridge",
  name: "Avižinė košė",
  mainProteins: ["egg_dairy"],
  ingredients: [{ id: "p1", position: 1, item: "Avižos", amount: 50, unit: "g" }],
  nutrition: { caloriesKcal: 300, carbohydrates: 50, protein: 10, fat: 5 },
};

const mince = {
  swaps: [
    {
      position: 1,
      original_protein: "beef",
      item: "Augalinis faršas",
      amount: 120,
      unit: "g",
      replacement_protein: "plant",
    },
  ],
  note: "Kepti 5 min.",
  nutrition: { calories_kcal: 470, carbohydrates: 42, protein: 30, fat: 14 },
};

function fakeAi(...answers: (unknown | Error)[]): AiClient {
  return {
    model: "fake-model",
    generateJson: vi.fn(async () => {
      const next = answers.length > 1 ? answers.shift() : answers[0];
      if (next instanceof Error) throw next;
      return next;
    }),
  };
}

describe("getOrCreateSwap", () => {
  let now: Date;
  const clock = () => now;
  const log = vi.fn();

  beforeEach(() => {
    now = new Date("2026-11-05T10:00:00Z");
    log.mockClear();
  });

  function setup(ai: AiClient, recipes = [chili, porridge]) {
    const memory = memoryStore(recipes, clock);
    const aiFactory = vi.fn(() => ai);
    const service = createProteinSwapService({
      store: memory.store,
      ai: aiFactory,
      now: clock,
      log,
      generateOptions: { sleep: async () => {} },
    });
    return { ...memory, service, aiFactory };
  }

  it("generates on the first request and serves the stored swap after that", async () => {
    const ai = fakeAi(mince);
    const { service, rows } = setup(ai);

    const first = await service.getOrCreateSwap("beef-chili", "vegetarian");
    expect(first).toMatchObject({
      status: "ready",
      generated: true,
      swap: {
        recipeId: "beef-chili",
        diet: "vegetarian",
        locale: "lt",
        note: "Kepti 5 min.",
        nutritionApproximate: true,
        nutrition: { caloriesKcal: 470 },
        items: [
          {
            position: 1,
            original: { item: "Liesa jautienos mėsa", amount: 120, unit: "g" },
            item: "Augalinis faršas",
            amount: 120,
            unit: "g",
            replacementProtein: "plant",
          },
        ],
      },
    });
    expect(rows.get("beef-chili/vegetarian/lt")?.status).toBe("ready");

    const second = await service.getOrCreateSwap("beef-chili", "vegetarian");
    expect(second).toMatchObject({ status: "ready", generated: false });
    expect(second.status === "ready" && second.swap.items).toEqual(first.status === "ready" && first.swap.items);
    expect(ai.generateJson).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ outcome: "ready", recipeId: "beef-chili", diet: "vegetarian" }));
  });

  it("keeps each diet separate", async () => {
    const ai = fakeAi(mince);
    const { service } = setup(ai);
    await service.getOrCreateSwap("beef-chili", "vegetarian");
    await service.getOrCreateSwap("beef-chili", "fish");
    await service.getOrCreateSwap("beef-chili", "vegetarian");
    expect(ai.generateJson).toHaveBeenCalledTimes(2);
  });

  it("makes one AI call when two requests miss at the same time", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const ai: AiClient = {
      model: "fake-model",
      generateJson: vi.fn(async () => {
        await gate;
        return mince;
      }),
    };
    const { service } = setup(ai);

    const first = service.getOrCreateSwap("beef-chili", "vegetarian");
    const second = service.getOrCreateSwap("beef-chili", "vegetarian");
    // Let both requests reach the claim before the AI answers.
    await new Promise((resolve) => setTimeout(resolve, 0));
    release();
    const results = await Promise.all([first, second]);

    expect(results.map((result) => result.status).sort()).toEqual(["pending", "ready"]);
    expect(ai.generateJson).toHaveBeenCalledTimes(1);
  });

  it("needs no AI for a recipe the diet already allows, or an unknown recipe", async () => {
    const { service, aiFactory } = setup(fakeAi(mince));
    expect(await service.getOrCreateSwap("porridge", "vegetarian")).toEqual({ status: "not-needed" });
    expect(await service.getOrCreateSwap("beef-chili", "beef")).toEqual({ status: "not-needed" });
    expect(await service.getOrCreateSwap("missing", "vegetarian")).toEqual({ status: "not-found" });
    expect(aiFactory).not.toHaveBeenCalled();
  });

  it("stores a failure, stays unavailable until the retry time, then tries again", async () => {
    const ai = fakeAi(new AiError("HTTP 503", true), new AiError("HTTP 503", true), new AiError("HTTP 503", true), mince);
    const { service, rows } = setup(ai);

    const failed = await service.getOrCreateSwap("beef-chili", "vegetarian");
    expect(failed).toEqual({ status: "unavailable", retryAfter: new Date("2026-11-05T10:05:00Z") });
    expect(rows.get("beef-chili/vegetarian/lt")).toMatchObject({ status: "failed", attempts: 1 });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failed", error: "HTTP 503", failures: 1 }));

    // Inside the wait: no AI call.
    now = new Date("2026-11-05T10:04:00Z");
    expect(await service.getOrCreateSwap("beef-chili", "vegetarian")).toMatchObject({ status: "unavailable" });
    expect(ai.generateJson).toHaveBeenCalledTimes(3);

    now = new Date("2026-11-05T10:05:00Z");
    expect(await service.getOrCreateSwap("beef-chili", "vegetarian")).toMatchObject({ status: "ready", generated: true });
    expect(ai.generateJson).toHaveBeenCalledTimes(4);
  });

  it("waits longer after a second failure", async () => {
    const { service, rows } = setup(fakeAi(new AiError("HTTP 503", true)));
    await service.getOrCreateSwap("beef-chili", "vegetarian");
    now = new Date("2026-11-05T10:06:00Z");
    const second = await service.getOrCreateSwap("beef-chili", "vegetarian");
    expect(second).toEqual({ status: "unavailable", retryAfter: new Date("2026-11-05T11:06:00Z") });
    expect(rows.get("beef-chili/vegetarian/lt")?.attempts).toBe(2);
  });

  it("releases the claim as failed when no AI client can be made", async () => {
    const memory = memoryStore([chili], clock);
    const service = createProteinSwapService({
      store: memory.store,
      ai: () => {
        throw new Error("The Gemini API key is not set (NUXT_GEMINI_API_KEY)");
      },
      now: clock,
      log,
    });
    expect(await service.getOrCreateSwap("beef-chili", "vegetarian")).toMatchObject({ status: "unavailable" });
    expect(memory.rows.get("beef-chili/vegetarian/lt")?.status).toBe("failed");
  });

  it("regenerates when the recipe's ingredients change", async () => {
    const ai = fakeAi(mince);
    const recipes = [structuredClone(chili)];
    const { service } = setup(ai, recipes);
    await service.getOrCreateSwap("beef-chili", "vegetarian");
    recipes[0]!.ingredients[1]!.amount = 100;
    expect(await service.getOrCreateSwap("beef-chili", "vegetarian")).toMatchObject({ generated: true });
    expect(ai.generateJson).toHaveBeenCalledTimes(2);
  });

  it("regenerates a rejected swap", async () => {
    const ai = fakeAi(mince);
    const { service, rows } = setup(ai);
    await service.getOrCreateSwap("beef-chili", "vegetarian");
    rows.get("beef-chili/vegetarian/lt")!.status = "rejected";
    expect(await service.getOrCreateSwap("beef-chili", "vegetarian")).toMatchObject({ generated: true });
  });

  it("takes over a claim whose request died", async () => {
    const ai = fakeAi(mince);
    const { service, store } = setup(ai);
    await store.claim({ recipeId: "beef-chili", diet: "vegetarian", locale: "lt" }, "whatever");
    expect(await service.getOrCreateSwap("beef-chili", "vegetarian")).toEqual({ status: "pending" });
    now = new Date(now.getTime() + CLAIM_TTL_MS + 1000);
    expect(await service.getOrCreateSwap("beef-chili", "vegetarian")).toMatchObject({ status: "ready" });
  });
});

const englishMince = { items: [{ position: 1, item: "Plant-based mince" }], note: "Fry for 5 min." };

describe("translateSwap", () => {
  const now = new Date("2026-11-05T10:00:00Z");
  const log = vi.fn();

  async function setup(...answers: unknown[]) {
    const memory = memoryStore([chili, porridge], () => now);
    const ai = fakeAi(mince, ...answers);
    const service = createProteinSwapService({
      store: memory.store,
      ai: () => ai,
      now: () => now,
      log,
      generateOptions: { sleep: async () => {} },
    });
    await service.getOrCreateSwap("beef-chili", "vegetarian");
    return { ...memory, ai, service };
  }

  it("translates a ready swap once, with the recipe's own translated line as context", async () => {
    const { service, ai, saved } = await setup(englishMince);

    expect(await service.translateSwap("beef-chili", "vegetarian", "en")).toEqual({ status: "translated" });
    expect(saved).toEqual([
      {
        locale: "en",
        sourceNote: "Kepti 5 min.",
        note: "Fry for 5 min.",
        items: [{ recipeIngredientId: "i1", sourceItem: "Augalinis faršas", item: "Plant-based mince" }],
      },
    ]);
    const prompt = vi.mocked(ai.generateJson).mock.calls[1]![0].prompt;
    expect(prompt).toContain('"Liesa jautienos mėsa" (British English: "Lean beef") -> "Augalinis faršas"');

    expect(await service.translateSwap("beef-chili", "vegetarian", "en")).toEqual({ status: "present" });
    expect(ai.generateJson).toHaveBeenCalledTimes(2);
  });

  it("serves the translation with the swap, without any AI", async () => {
    const { service, store } = await setup(englishMince);
    await service.translateSwap("beef-chili", "vegetarian", "en");

    const read = await createProteinSwapReader({ store }).readSwap("beef-chili", "vegetarian");
    expect(read).toMatchObject({
      status: "ready",
      swap: {
        note: "Kepti 5 min.",
        notes: [
          { locale: "lt", note: "Kepti 5 min." },
          { locale: "en", note: "Fry for 5 min." },
        ],
        items: [
          {
            item: "Augalinis faršas",
            texts: [
              { locale: "lt", item: "Augalinis faršas" },
              { locale: "en", item: "Plant-based mince" },
            ],
          },
        ],
      },
    });
  });

  it("asks again with the errors of an invalid answer, and logs a failure without storing anything", async () => {
    const wrong = { items: [{ position: 1, item: "Beef mince" }], note: "Fry." };
    const { service, saved, ai } = await setup(wrong, englishMince);
    expect(await service.translateSwap("beef-chili", "vegetarian", "en")).toEqual({ status: "translated" });
    expect(vi.mocked(ai.generateJson).mock.calls[2]![0].prompt).toContain("reads as beef");
    expect(saved).toHaveLength(1);

    const failing = await setup(new AiError("HTTP 400", false));
    expect(await failing.service.translateSwap("beef-chili", "vegetarian", "en")).toEqual({ status: "failed", error: "HTTP 400" });
    expect(failing.saved).toEqual([]);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: "protein_swap.translate", outcome: "failed", to: "en" }));
  });

  it("has nothing to translate without a ready swap from the current ingredients", async () => {
    const { service } = await setup(englishMince);
    expect(await service.translateSwap("beef-chili", "fish", "en")).toEqual({ status: "no-swap" });
    expect(await service.translateSwap("missing", "fish", "en")).toEqual({ status: "no-swap" });
  });

  it("translates again after the swap is regenerated", async () => {
    const { service, rows } = await setup(englishMince, mince, englishMince);
    await service.translateSwap("beef-chili", "vegetarian", "en");
    rows.get("beef-chili/vegetarian/lt")!.status = "rejected";
    await service.getOrCreateSwap("beef-chili", "vegetarian");
    expect(await service.translateSwap("beef-chili", "vegetarian", "en")).toEqual({ status: "translated" });
  });
});

describe("readSwap", () => {
  it("reads stored swaps only: a miss or a stale swap is missing, and no AI client exists", async () => {
    const now = new Date("2026-11-05T10:00:00Z");
    const recipes = [structuredClone(chili), porridge];
    const memory = memoryStore(recipes, () => now);
    const reader = createProteinSwapReader({ store: memory.store });

    expect(await reader.readSwap("beef-chili", "vegetarian")).toEqual({ status: "missing" });
    expect(memory.rows.size).toBe(0);
    expect(await reader.readSwap("porridge", "vegetarian")).toEqual({ status: "not-needed" });
    expect(await reader.readSwap("missing", "vegetarian")).toEqual({ status: "not-found" });

    const service = createProteinSwapService({ store: memory.store, ai: () => fakeAi(mince), now: () => now, log: () => {} });
    await service.getOrCreateSwap("beef-chili", "vegetarian");
    expect(await reader.readSwap("beef-chili", "vegetarian")).toMatchObject({ status: "ready" });

    recipes[0]!.ingredients[1]!.amount = 100;
    expect(await reader.readSwap("beef-chili", "vegetarian")).toEqual({ status: "missing" });
  });
});

describe("recipeSourceHash", () => {
  it("changes with the ingredients and main proteins, not with the name", () => {
    const hash = recipeSourceHash(chili);
    expect(recipeSourceHash({ ...chili, name: "Kitas" })).toBe(hash);
    expect(recipeSourceHash({ ...chili, mainProteins: ["pork"] })).not.toBe(hash);
    expect(recipeSourceHash({ ...chili, ingredients: chili.ingredients.slice(0, 1) })).not.toBe(hash);
  });
});
