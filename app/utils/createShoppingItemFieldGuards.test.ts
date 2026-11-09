import { describe, expect, it } from "vitest";
import { createShoppingItemFieldGuards, REMOTE_ECHO_WAIT_MS } from "./createShoppingItemFieldGuards";

describe("createShoppingItemFieldGuards", () => {
  it("guards a field while its change is on the way", () => {
    const guards = createShoppingItemFieldGuards();

    guards.begin("a", { state: "bought" });

    expect([...guards.getGuardedFields("a", 0)]).toEqual(["state"]);
    expect(guards.getGuardedFields("b", 0).size).toBe(0);
  });

  it("keeps guarding a saved change until its echo arrives", () => {
    const guards = createShoppingItemFieldGuards();
    const changeId = guards.begin("a", { state: "bought" });
    guards.settle("a", changeId, true, 100);

    guards.acknowledge("a", { state: "to_buy" });
    expect(guards.getGuardedFields("a", 200).has("state")).toBe(true);

    guards.acknowledge("a", { state: "bought" });
    expect(guards.getGuardedFields("a", 200).size).toBe(0);
  });

  it("stops guarding a saved change when the echo does not come in time", () => {
    const guards = createShoppingItemFieldGuards();
    const changeId = guards.begin("a", { amountOverride: 800 });
    guards.settle("a", changeId, true, 100);

    expect(guards.getGuardedFields("a", 100 + REMOTE_ECHO_WAIT_MS - 1).has("amountOverride")).toBe(true);
    expect(guards.getGuardedFields("a", 100 + REMOTE_ECHO_WAIT_MS).size).toBe(0);
  });

  it("stops guarding at once when the echo came before the database answered", () => {
    const guards = createShoppingItemFieldGuards();
    const changeId = guards.begin("a", { state: "bought" });

    guards.acknowledge("a", { state: "bought" });
    expect(guards.getGuardedFields("a", 0).has("state")).toBe(true);
    guards.settle("a", changeId, true, 10);

    expect(guards.getGuardedFields("a", 10).size).toBe(0);
  });

  it("stops guarding a refused change", () => {
    const guards = createShoppingItemFieldGuards();
    const changeId = guards.begin("a", { isPresent: false });

    guards.settle("a", changeId, false, 10);

    expect(guards.getGuardedFields("a", 10).size).toBe(0);
  });

  it("tells whether a change is still the newest of its field", () => {
    const guards = createShoppingItemFieldGuards();
    const first = guards.begin("a", { state: "bought", amountOverride: 500 });
    const second = guards.begin("a", { state: "to_buy" });

    expect(guards.isLatest("a", "state", first)).toBe(false);
    expect(guards.isLatest("a", "amountOverride", first)).toBe(true);
    expect(guards.isLatest("a", "state", second)).toBe(true);
  });

  it("leaves a later change of the same field guarded when an earlier one settles", () => {
    const guards = createShoppingItemFieldGuards();
    const first = guards.begin("a", { state: "bought" });
    guards.begin("a", { state: "to_buy" });

    guards.settle("a", first, false, 10);
    guards.acknowledge("a", { state: "bought" });

    expect(guards.getGuardedFields("a", 10).has("state")).toBe(true);
  });
});
