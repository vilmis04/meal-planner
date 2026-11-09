import { describe, expect, it, vi } from "vitest";
import { createCoalescedRunner } from "./createCoalescedRunner";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createCoalescedRunner", () => {
  it("runs once more after the running task, however often it was asked meanwhile", async () => {
    const finishers: (() => void)[] = [];
    const task = vi.fn(() => new Promise<void>((resolve) => finishers.push(resolve)));
    const run = createCoalescedRunner(task);

    run();
    run();
    run();
    expect(task).toHaveBeenCalledTimes(1);

    finishers[0]?.();
    await flush();
    expect(task).toHaveBeenCalledTimes(2);

    finishers[1]?.();
    await flush();
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("keeps running after a task failed", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const task = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const run = createCoalescedRunner(task);

    run();
    await flush();
    run();
    await flush();

    expect(task).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
  });
});
