import { describe, expect, it, vi } from "vitest";
import { memoizeAsync } from "./memoizeAsync";

describe("memoizeAsync", () => {
  it("loads once and shares the result", async () => {
    const load = vi.fn(async () => ["recipe"]);
    const getRecipes = memoizeAsync(load);

    const [first, second] = await Promise.all([getRecipes(), getRecipes()]);
    expect(await getRecipes()).toBe(first);
    expect(second).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("tries again after a failed load", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce("loaded");
    const getValue = memoizeAsync(load);

    await expect(getValue()).rejects.toThrow("timeout");
    await expect(getValue()).resolves.toBe("loaded");
    expect(load).toHaveBeenCalledTimes(2);
  });
});
