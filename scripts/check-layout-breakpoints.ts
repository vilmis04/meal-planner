/*
 * Refuses media query widths that are not the app's layout breakpoints (X4). See scripts/layoutBreakpointCheck.ts
 * and shared/utils/layoutBreakpoints.ts.
 *
 *   npm run layout:check
 *
 * Prints each problem and exits 1 when there is any.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SourceFile } from "./localeCheck.types";
import { checkLayoutBreakpoints } from "./layoutBreakpointCheck";

const SOURCE_DIR = "app";
// Matches "app/pages/plans/index.vue" and "app/assets/css/tokens.css".
const SOURCE_FILE_REGEX = /\.(?:vue|css)$/;

const sourceFiles: SourceFile[] = readdirSync(SOURCE_DIR, { recursive: true, encoding: "utf8" })
  .filter((file) => SOURCE_FILE_REGEX.test(file))
  .map((file) => ({ path: join(SOURCE_DIR, file), text: readFileSync(join(SOURCE_DIR, file), "utf8") }));

const problems = checkLayoutBreakpoints(sourceFiles);

if (problems.length) {
  console.error(`Layout breakpoint check failed with ${problems.length} problem(s); use the layout breakpoints (see README, "Responsive layout"):`);
  for (const problem of problems) {
    console.error(`  ${problem}`);
  }
  process.exit(1);
}

console.log(`Layout breakpoints OK: ${sourceFiles.length} source files.`);
