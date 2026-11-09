import { describe, expect, it } from "vitest";
import { getGenerationDoneKey } from "./getGenerationDoneKey";

describe("getGenerationDoneKey", () => {
  it("is plain when every slot was filled the ideal way", () => {
    expect(getGenerationDoneKey({ emptyCount: 0, compromisedCount: 0 })).toBe("plan.generate.done");
  });

  it("points to the notes when a slot is empty or compromised", () => {
    expect(getGenerationDoneKey({ emptyCount: 1, compromisedCount: 0 })).toBe("plan.generate.doneWithNotes");
    expect(getGenerationDoneKey({ emptyCount: 0, compromisedCount: 2 })).toBe("plan.generate.doneWithNotes");
  });

  it("says the unlocked slots were regenerated after a regeneration", () => {
    expect(getGenerationDoneKey({ emptyCount: 0, compromisedCount: 0 }, "regenerate_unlocked")).toBe("plan.regenerate.done");
    expect(getGenerationDoneKey({ emptyCount: 0, compromisedCount: 1 }, "regenerate_unlocked")).toBe(
      "plan.regenerate.doneWithNotes",
    );
  });
});
