import { describe, expect, it, vi } from "vitest";
import type { PlanAdjustment } from "../../shared/utils/planAdjustment.types";
import { AiError } from "./ai/gemini";
import type { AiClient } from "./ai/gemini.types";
import { createPlanAdjustmentService } from "./planAdjustmentService";
import type { PlanAdjustmentStore } from "./planAdjustmentStore.types";

const PLAN_ID = "00000000-0000-0000-0000-0000000000a1";
const MUSHROOM_ID = "00000000-0000-4000-8000-000000000001";

const VALID_ANSWER = {
  excluded_proteins: [{ protein: "fish", day_indexes: null, meal_types: null }],
  excluded_ingredients: [{ ingredient: "Pievagrybiai", day_indexes: [0], meal_types: ["dinner"] }],
  quick_meals: [{ day_indexes: [0], meal_types: ["dinner"] }],
  unsupported: ["under 20 minutes"],
};

const INTERPRETED: PlanAdjustment = {
  constraints: {
    excludedProteins: [{ protein: "fish", dayIndexes: null, mealTypes: null }],
    excludedIngredients: [
      { ingredientId: MUSHROOM_ID, ingredientName: "Pievagrybiai", dayIndexes: [0], mealTypes: ["dinner"] },
    ],
    quickMeals: [{ dayIndexes: [0], mealTypes: ["dinner"] }],
  },
  unsupported: ["under 20 minutes"],
};

const fakeAi = (...answers: unknown[]): AiClient & { prompts: string[] } => {
  const prompts: string[] = [];
  return {
    model: "fake-model",
    prompts,
    generateJson: vi.fn(async ({ prompt }: { prompt: string }) => {
      prompts.push(prompt);
      const next = answers.shift();
      if (next instanceof Error) throw next;
      return next;
    }),
  };
};

// An in-memory store: one 3-day plan without snacks the user can open, and a cache.
const makeStore = (overrides: Partial<PlanAdjustmentStore> = {}) => {
  const cache = new Map<string, PlanAdjustment>();
  const store: PlanAdjustmentStore = {
    loadPlan: async (planId) =>
      planId === PLAN_ID ? { id: PLAN_ID, startDate: "2026-11-16", dayCount: 3, includeSnacks: false } : null,
    loadIngredients: async () => [{ id: MUSHROOM_ID, name: "Pievagrybiai" }],
    loadInterpretation: async (promptHash) => cache.get(promptHash) ?? null,
    saveInterpretation: async (promptHash, _model, adjustment) => {
      cache.set(promptHash, adjustment);
    },
    ...overrides,
  };
  return { store, cache };
};

const allow = () => true;
const noSleep = async () => {};

describe("plan adjustment service", () => {
  it("interprets the request with the plan as context and caches the answer", async () => {
    const ai = fakeAi(VALID_ANSWER);
    const { store, cache } = makeStore();
    const log = vi.fn();
    const service = createPlanAdjustmentService({ store, ai: () => ai, log });

    const result = await service.interpret(PLAN_ID, "no fish, quick dinner Monday", { allowAiCall: allow });

    expect(result).toEqual({ status: "interpreted", adjustment: INTERPRETED });
    expect(ai.prompts[0]).toContain("2: Wednesday 2026-11-18");
    expect(ai.prompts[0]).toContain("Meal types in the plan: breakfast, lunch, dinner.");
    expect(ai.prompts[0]).toContain('Request: "no fish, quick dinner Monday"');
    expect([...cache.values()]).toEqual([INTERPRETED]);
    expect([...cache.keys()][0]).toMatch(/^[0-9a-f]{64}$/);
    // The user's words stay out of the logs.
    expect(JSON.stringify(log.mock.calls)).not.toContain("no fish");
  });

  it("answers the same request from the cache, without the AI or the limit", async () => {
    const ai = fakeAi(VALID_ANSWER);
    const { store } = makeStore();
    const service = createPlanAdjustmentService({ store, ai: () => ai, log: vi.fn() });
    await service.interpret(PLAN_ID, "no fish", { allowAiCall: allow });

    const allowAiCall = vi.fn(() => false);
    const again = await service.interpret(PLAN_ID, "no fish", { allowAiCall });
    expect(again).toEqual({ status: "interpreted", adjustment: INTERPRETED });
    expect(ai.generateJson).toHaveBeenCalledTimes(1);
    expect(allowAiCall).not.toHaveBeenCalled();
  });

  it("asks again with the errors when the answer breaks the rules", async () => {
    const wrong = { ...VALID_ANSWER, quick_meals: [{ day_indexes: [5], meal_types: ["dinner"] }] };
    const ai = fakeAi(wrong, VALID_ANSWER);
    const service = createPlanAdjustmentService({ store: makeStore().store, ai: () => ai, log: vi.fn() });

    const result = await service.interpret(PLAN_ID, "no fish", { allowAiCall: allow });
    expect(result.status).toBe("interpreted");
    expect(ai.prompts[1]).toContain("quick_meals[0].day_indexes: 5 not in the plan (0 to 2)");
  });

  it("is unavailable when the AI keeps failing, and caches nothing", async () => {
    const ai = fakeAi(new AiError("HTTP 503", true), { nope: true }, new AiError("HTTP 500", true));
    const { store, cache } = makeStore();
    const service = createPlanAdjustmentService({
      store,
      ai: () => ai,
      log: vi.fn(),
      generateOptions: { sleep: noSleep },
    });

    expect(await service.interpret(PLAN_ID, "no fish", { allowAiCall: allow })).toEqual({ status: "unavailable" });
    expect(cache.size).toBe(0);
  });

  it("is unavailable when no AI client can be made", async () => {
    const service = createPlanAdjustmentService({
      store: makeStore().store,
      ai: () => {
        throw new Error("The Gemini API key is not set");
      },
      log: vi.fn(),
    });
    expect(await service.interpret(PLAN_ID, "no fish", { allowAiCall: allow })).toEqual({ status: "unavailable" });
  });

  it("refuses a user over the limit before calling the AI", async () => {
    const ai = fakeAi(VALID_ANSWER);
    const service = createPlanAdjustmentService({ store: makeStore().store, ai: () => ai, log: vi.fn() });
    expect(await service.interpret(PLAN_ID, "no fish", { allowAiCall: () => false })).toEqual({ status: "limited" });
    expect(ai.generateJson).not.toHaveBeenCalled();
  });

  it("says when the plan cannot be opened, without calling the AI", async () => {
    const ai = fakeAi(VALID_ANSWER);
    const service = createPlanAdjustmentService({ store: makeStore().store, ai: () => ai, log: vi.fn() });
    expect(await service.interpret("00000000-0000-0000-0000-0000000000ff", "no fish", { allowAiCall: allow })).toEqual({
      status: "not-found",
    });
    expect(ai.generateJson).not.toHaveBeenCalled();
  });

  it("still answers when caching fails", async () => {
    const ai = fakeAi(VALID_ANSWER);
    const { store } = makeStore({
      saveInterpretation: async () => {
        throw new Error("database down");
      },
    });
    const service = createPlanAdjustmentService({ store, ai: () => ai, log: vi.fn() });
    expect((await service.interpret(PLAN_ID, "no fish", { allowAiCall: allow })).status).toBe("interpreted");
  });
});
