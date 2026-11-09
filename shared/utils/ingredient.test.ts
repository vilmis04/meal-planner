import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INGREDIENT_CATEGORIES } from "./ingredient";

const MIGRATION_PATH = "supabase/migrations/20261113000000_create_ingredients.sql";
const REPORT_PATH = "supabase/reports/ingredient-mapping-report.sql";

// The quoted values of the category check, e.g. "category in (\n 'fruit_and_vegetables', 'meat_and_fish', ...\n )".
const CATEGORY_CHECK_REGEX = /category in \(([^)]*)\)/;
// One row of the report's category list, e.g. "('fruit_and_vegetables', 1, 'Fruit and vegetables')".
const REPORT_CATEGORY_REGEX = /\('([a-z_]+)', (\d+), '[^']+'\)/g;
// A quoted SQL string, e.g. "'pantry'".
const QUOTED_VALUE_REGEX = /'([^']+)'/g;

const readRepositoryFile = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("INGREDIENT_CATEGORIES", () => {
  it("lists the seven shopping categories in list order", () => {
    expect([...INGREDIENT_CATEGORIES]).toEqual([
      "fruit_and_vegetables",
      "meat_and_fish",
      "dairy_and_eggs",
      "grains_and_bread",
      "pantry",
      "frozen",
      "other",
    ]);
  });

  it("matches the categories the database allows", () => {
    const categoryCheck = CATEGORY_CHECK_REGEX.exec(readRepositoryFile(MIGRATION_PATH))?.[1] ?? "";
    const allowedCategories = [...categoryCheck.matchAll(QUOTED_VALUE_REGEX)].map((match) => match[1]);

    expect(allowedCategories).toEqual([...INGREDIENT_CATEGORIES]);
  });

  it("matches the categories of the mapping report, in the same order", () => {
    const reportCategories = [...readRepositoryFile(REPORT_PATH).matchAll(REPORT_CATEGORY_REGEX)]
      .sort((first, second) => Number(first[2]) - Number(second[2]))
      .map((match) => match[1]);

    expect(reportCategories).toEqual([...INGREDIENT_CATEGORIES]);
  });
});
