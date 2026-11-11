import { describe, expect, it } from "vitest";
import { selectLithuanianPluralForm } from "./pluralRules";

describe("selectLithuanianPluralForm", () => {
  it.each([
    [1, 0],
    [21, 0],
    [101, 0],
    [2, 1],
    [9, 1],
    [22, 1],
    [0, 2],
    [10, 2],
    [11, 2],
    [12, 2],
    [19, 2],
    [20, 2],
    [30, 2],
    [111, 2],
  ])("reads %s with form %s of one | few | other", (count, form) => {
    expect(selectLithuanianPluralForm(count, 3)).toBe(form);
  });

  it("uses the zero form first when there are four", () => {
    expect(selectLithuanianPluralForm(0, 4)).toBe(0);
    expect(selectLithuanianPluralForm(1, 4)).toBe(1);
    expect(selectLithuanianPluralForm(3, 4)).toBe(2);
    expect(selectLithuanianPluralForm(15, 4)).toBe(3);
  });

  it("reads a fraction like few", () => {
    expect(selectLithuanianPluralForm(1.5, 3)).toBe(1);
  });

  it("always takes the only form of an undeclined message", () => {
    expect(selectLithuanianPluralForm(7, 1)).toBe(0);
  });
});
