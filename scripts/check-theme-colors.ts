/*
 * Refuses colors that are not theme colors in the app's components, pages, layouts and styles (X1d).
 * See scripts/themeColorCheck.ts.
 *
 *   npm run theme:check
 *
 * Prints each problem and exits 1 when there is any.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SourceFile } from "./localeCheck.types";
import { checkThemeColors } from "./themeColorCheck";

const SOURCE_DIR = "app";
// Matches "app/pages/login.vue", "app/utils/recipeRating.ts" and "app/assets/css/theme.css"; not "recipe.test.ts".
const SOURCE_FILE_REGEX = /(?<!\.test|\.d)\.(?:vue|ts|css)$/;

const sourceFiles: SourceFile[] = readdirSync(SOURCE_DIR, { recursive: true, encoding: "utf8" })
  .filter((file) => SOURCE_FILE_REGEX.test(file))
  .map((file) => ({ path: join(SOURCE_DIR, file), text: readFileSync(join(SOURCE_DIR, file), "utf8") }));

const problems = checkThemeColors(sourceFiles);

if (problems.length) {
  console.error(`Theme color check failed with ${problems.length} problem(s); use the theme's colors (see README, "Styling conventions"):`);
  for (const problem of problems) {
    console.error(`  ${problem}`);
  }
  process.exit(1);
}

console.log(`Theme colors OK: ${sourceFiles.length} source files.`);
