import { describe, expect, it } from "vitest";
import { SEED_LIMIT, createSeededRandom, pickWeighted } from "./seededRandom";

describe("createSeededRandom", () => {
  it("gives the same sequence for the same seed", () => {
    const first = createSeededRandom(42);
    const second = createSeededRandom(42);
    const firstValues = Array.from({ length: 5 }, () => first());
    expect(Array.from({ length: 5 }, () => second())).toEqual(firstValues);
  });

  it("gives another sequence for another seed", () => {
    const first = createSeededRandom(1);
    const second = createSeededRandom(2);
    expect(first()).not.toBe(second());
  });

  it("stays in [0, 1) and treats seeds as unsigned 32-bit numbers", () => {
    const random = createSeededRandom(SEED_LIMIT - 1);
    for (let i = 0; i < 1000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    expect(createSeededRandom(SEED_LIMIT + 7)()).toBe(createSeededRandom(7)());
  });
});

describe("pickWeighted", () => {
  it("returns null when nothing has a positive weight", () => {
    expect(pickWeighted([], () => 1, () => 0.5)).toBeNull();
    expect(pickWeighted(["a", "b"], () => 0, () => 0.5)).toBeNull();
  });

  it("picks by cumulative weight", () => {
    const weights: Record<string, number> = { a: 1, b: 0, c: 3 };
    const getWeight = (item: string) => weights[item] ?? 0;
    expect(pickWeighted(["a", "b", "c"], getWeight, () => 0)).toBe("a");
    expect(pickWeighted(["a", "b", "c"], getWeight, () => 0.24)).toBe("a");
    expect(pickWeighted(["a", "b", "c"], getWeight, () => 0.26)).toBe("c");
    expect(pickWeighted(["a", "b", "c"], getWeight, () => 0.9999999)).toBe("c");
  });

  it("never picks a zero weight, even at the very end", () => {
    const weights: Record<string, number> = { a: 1, b: 0 };
    expect(pickWeighted(["a", "b"], (item) => weights[item] ?? 0, () => 0.9999999999)).toBe("a");
  });

  it("treats a negative weight as none, so it neither gets picked nor shrinks the others' share", () => {
    const weights: Record<string, number> = { a: 1, b: -5, c: 1 };
    const getWeight = (item: string) => weights[item] ?? 0;
    expect(pickWeighted(["b"], getWeight, () => 0.5)).toBeNull();
    expect(pickWeighted(["a", "b", "c"], getWeight, () => 0.49)).toBe("a");
    expect(pickWeighted(["a", "b", "c"], getWeight, () => 0.51)).toBe("c");
  });

  it("returns the last weighted item when rounding leaves a sliver past the total", () => {
    const weights: Record<string, number> = { a: 0.1, b: 0.2, c: 0 };
    // A draw at the very top of the range is left a hair above zero after every weight (0.1 + 0.2 rounds up).
    expect(pickWeighted(["a", "b", "c"], (item) => weights[item] ?? 0, () => 1)).toBe("b");
  });

  it("follows the weights over many draws", () => {
    const random = createSeededRandom(7);
    const counts = { light: 0, heavy: 0 };
    for (let i = 0; i < 4000; i++) {
      const picked = pickWeighted(["light", "heavy"] as const, (item) => (item === "heavy" ? 3 : 1), random);
      if (picked) {
        counts[picked]++;
      }
    }
    expect(counts.heavy / counts.light).toBeGreaterThan(2.5);
    expect(counts.heavy / counts.light).toBeLessThan(3.5);
  });
});
