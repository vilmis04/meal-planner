import { describe, expect, it } from "vitest";
import { parseStoredGroupExpansion, setStoredGroupExpansion } from "./shoppingListGroupExpansion";

describe("parseStoredGroupExpansion", () => {
  it("reads a saved state", () => {
    expect(parseStoredGroupExpansion('{"list-1":{"frozen":false,"extras":true}}')).toEqual({
      "list-1": { frozen: false, extras: true },
    });
  });

  it("treats nothing saved, broken JSON and another shape as nothing saved", () => {
    expect(parseStoredGroupExpansion(null)).toEqual({});
    expect(parseStoredGroupExpansion("{not json")).toEqual({});
    expect(parseStoredGroupExpansion('{"list-1":["frozen"]}')).toEqual({});
    expect(parseStoredGroupExpansion('"frozen"')).toEqual({});
  });
});

describe("setStoredGroupExpansion", () => {
  it("changes one group of one list and keeps the others", () => {
    const stored = { "list-1": { frozen: false }, "list-2": { pantry: false } };

    expect(setStoredGroupExpansion(stored, "list-1", "pantry", false)).toEqual({
      "list-2": { pantry: false },
      "list-1": { frozen: false, pantry: false },
    });
    expect(setStoredGroupExpansion(stored, "list-1", "frozen", true)["list-1"]).toEqual({ frozen: true });
  });

  it("makes the changed list the newest and keeps the ten newest lists", () => {
    const stored = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [`list-${index}`, { frozen: false }]),
    );

    const updated = setStoredGroupExpansion(stored, "list-new", "pantry", false);

    expect(Object.keys(updated)).toHaveLength(10);
    expect(Object.keys(updated)[0]).toBe("list-1");
    expect(Object.keys(updated).at(-1)).toBe("list-new");
  });

  it("does not change the saved state it was given", () => {
    const stored = { "list-1": { frozen: false } };

    setStoredGroupExpansion(stored, "list-1", "frozen", true);

    expect(stored).toEqual({ "list-1": { frozen: false } });
  });
});
