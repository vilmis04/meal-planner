/*
 * Checks the locale files against each other and the keys the code uses (X1). See scripts/localeCheck.ts.
 *
 *   npm run i18n:check
 *
 * Prints each problem and exits 1 when there is any.
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { checkLocales } from "./localeCheck";
import type { SourceFile } from "./localeCheck.types";

const LOCALES_DIR = "i18n/locales";
const SOURCE_DIRS = ["app", "server", "shared"];
// Matches "app/pages/login.vue" and "shared/utils/diet.ts"; not "diet.test.ts" or "env.d.ts".
const SOURCE_FILE_REGEX = /(?<!\.test|\.d)\.(?:vue|ts)$/;
// Matches "en.json" and "lt.json".
const LOCALE_FILE_REGEX = /\.json$/;

const locales = Object.fromEntries(
  readdirSync(LOCALES_DIR)
    .filter((file) => LOCALE_FILE_REGEX.test(file))
    .map((file): [string, unknown] => [
      basename(file, ".json"),
      JSON.parse(readFileSync(join(LOCALES_DIR, file), "utf8")),
    ]),
);

const sourceFiles: SourceFile[] = SOURCE_DIRS.flatMap((dir) =>
  readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => SOURCE_FILE_REGEX.test(file))
    .map((file) => ({ path: join(dir, file), text: readFileSync(join(dir, file), "utf8") })),
);

const problems = checkLocales({ locales, sourceFiles });

if (problems.length) {
  console.error(`Translation check failed with ${problems.length} problem(s):`);
  for (const problem of problems) {
    console.error(`  ${problem}`);
  }
  process.exit(1);
}

console.log(`Translations OK: ${Object.keys(locales).join(", ")}, ${sourceFiles.length} source files.`);
