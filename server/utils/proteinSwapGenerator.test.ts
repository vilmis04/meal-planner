import { describe, expect, it, vi } from "vitest";
import type { SwapRecipe } from "../../shared/utils/proteinSwap";
import { AiError } from "./ai/gemini";
import type { AiClient } from "./ai/gemini";
import { generateSwap } from "./proteinSwapGenerator";

const recipe: SwapRecipe = {
  id: "r1",
  name: "Meduje kepta vištiena",
  mainProteins: ["poultry"],
  ingredients: [
    { id: "i1", position: 1, item: "Vištienos filė", amount: 120, unit: "g" },
    { id: "i2", position: 2, item: "Medus", amount: 10, unit: "g" },
  ],
  nutrition: { caloriesKcal: 400, carbohydrates: 30, protein: 35, fat: 10 },
};

const valid = {
  swaps: [{ position: 1, original_protein: "poultry", item: "Tofu", amount: 150, unit: "g", replacement_protein: "plant" }],
  note: null,
  nutrition: { calories_kcal: 380, carbohydrates: 30, protein: 25, fat: 14 },
};

function fakeAi(...answers: (unknown | Error)[]): AiClient & { prompts: string[] } {
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
}

const noSleep = vi.fn(async () => {});

describe("generateSwap", () => {
  it("returns a valid first answer", async () => {
    const ai = fakeAi(valid);
    const result = await generateSwap(ai, recipe, "vegetarian", { sleep: noSleep });
    expect(result).toMatchObject({ ok: true, attempts: 1, swap: { items: [{ item: "Tofu", amount: 150 }] } });
  });

  it("waits and retries after a rate limit", async () => {
    const sleep = vi.fn(async () => {});
    const ai = fakeAi(new AiError("Gemini answered HTTP 429", true), valid);
    const result = await generateSwap(ai, recipe, "vegetarian", { sleep });
    expect(result).toMatchObject({ ok: true, attempts: 2 });
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("asks again with the validation errors after an invalid answer", async () => {
    const wrong = { ...valid, swaps: [{ ...valid.swaps[0], position: 7 }] };
    const ai = fakeAi(wrong, valid);
    const result = await generateSwap(ai, recipe, "vegetarian", { sleep: noSleep });
    expect(result).toMatchObject({ ok: true, attempts: 2 });
    expect(ai.prompts[0]).not.toContain("previous answer was rejected");
    expect(ai.prompts[1]).toContain("position 7: the recipe has no ingredient at this position");
  });

  it("gives up after three attempts and reports each one", async () => {
    const failed = vi.fn();
    const ai = fakeAi(new AiError("HTTP 503", true), { nope: true }, new AiError("HTTP 500", true), valid);
    const result = await generateSwap(ai, recipe, "vegetarian", { sleep: noSleep, onAttemptFailed: failed });
    expect(result).toEqual({ ok: false, error: "HTTP 500", attempts: 3 });
    expect(ai.generateJson).toHaveBeenCalledTimes(3);
    expect(failed).toHaveBeenCalledTimes(3);
  });

  it("stops at once on an error that will not go away", async () => {
    const ai = fakeAi(new AiError("Gemini answered HTTP 400", false), valid);
    const result = await generateSwap(ai, recipe, "vegetarian", { sleep: noSleep });
    expect(result).toEqual({ ok: false, error: "Gemini answered HTTP 400", attempts: 1 });
    expect(ai.generateJson).toHaveBeenCalledTimes(1);
  });
});
