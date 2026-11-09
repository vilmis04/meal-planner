import { describe, expect, it } from "vitest";
import { createOrderedSender } from "./createOrderedSender";

interface Deferred {
  promise: Promise<string>;
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
}

const createDeferred = (): Deferred => {
  let resolve: Deferred["resolve"] = () => undefined;
  let reject: Deferred["reject"] = () => undefined;
  const promise = new Promise<string>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createOrderedSender", () => {
  it("sends a call with the same key only after the one before it settled", async () => {
    const sendInOrder = createOrderedSender();
    const first = createDeferred();
    const sent: string[] = [];

    const firstCall = sendInOrder("onion", () => {
      sent.push("bought");
      return first.promise;
    });
    const secondCall = sendInOrder("onion", () => {
      sent.push("to_buy");
      return Promise.resolve("second");
    });
    await flush();
    expect(sent).toEqual(["bought"]);

    first.resolve("first");
    await expect(firstCall).resolves.toBe("first");
    await expect(secondCall).resolves.toBe("second");
    expect(sent).toEqual(["bought", "to_buy"]);
  });

  it("still sends the next call when the one before it failed", async () => {
    const sendInOrder = createOrderedSender();
    const first = createDeferred();

    const firstCall = sendInOrder("onion", () => first.promise);
    const secondCall = sendInOrder("onion", () => Promise.resolve("second"));
    first.reject(new Error("offline"));

    await expect(firstCall).rejects.toThrow("offline");
    await expect(secondCall).resolves.toBe("second");
  });

  it("does not hold back calls with another key", async () => {
    const sendInOrder = createOrderedSender();
    const sent: string[] = [];

    void sendInOrder("onion", () => createDeferred().promise);
    void sendInOrder("carrots", () => {
      sent.push("carrots");
      return Promise.resolve("carrots");
    });
    await flush();

    expect(sent).toEqual(["carrots"]);
  });
});
