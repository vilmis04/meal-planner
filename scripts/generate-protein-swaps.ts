/*
 * Optional backfill for protein swaps (D2): asks for the swap of every recipe and diet it conflicts with,
 * through the same service the app uses on demand, so pairs already stored are read, not regenerated.
 * Run it before a release to spare the first viewers the wait, or after rejecting swaps.
 *
 *   npm run swaps:generate                      all missing pairs
 *   npm run swaps:generate -- --dry-run         list pairs and their stored status, call nothing
 *   npm run swaps:generate -- --recipe <uuid> --diet vegetarian
 *
 * Reads NUXT_PUBLIC_SUPABASE_URL, NUXT_SUPABASE_SERVICE_ROLE_KEY, NUXT_GEMINI_API_KEY and optionally
 * NUXT_GEMINI_MODEL / NUXT_GEMINI_BASE_URL from .env. Writes a review report (swap-review.md) and exits 1
 * when any pair is still without a swap.
 */
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { DIETS, isProtein } from "../shared/utils/diet";
import type { Diet, Protein } from "../shared/utils/diet";
import { fetchAllPages } from "../shared/utils/fetchAllPages";
import { conflictingDiets } from "../shared/utils/proteinSwap";
import type { ProteinSwapView } from "../shared/utils/proteinSwap";
import { createGeminiClient } from "../server/utils/ai/gemini";
import { createProteinSwapService } from "../server/utils/proteinSwapService";
import type { GetSwapResult } from "../server/utils/proteinSwapService";
import { createSupabaseSwapStore } from "../server/utils/proteinSwapStore";

const CONCURRENCY = 2;
const PAGE_SIZE = 1000;
const REPORT_PATH = "swap-review.md";

interface RecipeRow {
  id: string;
  name: string;
  main_proteins: string[];
  calories_kcal: number | null;
}

interface Pair {
  recipe: RecipeRow;
  diet: Diet;
}

// Variables already set in the environment win over .env; a missing .env is fine.
try {
  process.loadEnvFile(".env");
} catch {
  // no .env file
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is not set (see .env.example)`);
    process.exit(2);
  }
  return value;
}

const { values: args } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    recipe: { type: "string" },
    diet: { type: "string" },
  },
});

if (args.diet && !(DIETS as readonly string[]).includes(args.diet)) {
  console.error(`--diet must be one of ${DIETS.join(", ")}`);
  process.exit(2);
}

const db = createClient(requireEnv("NUXT_PUBLIC_SUPABASE_URL"), requireEnv("NUXT_SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function loadRecipes(): Promise<RecipeRow[]> {
  return fetchAllPages(async (from, to) => {
    let query = db
      .from("recipes")
      .select("id, name, main_proteins, calories_kcal", { count: "exact" })
      .order("name")
      .order("id")
      .range(from, to);
    if (args.recipe) query = query.eq("id", args.recipe);
    const { data, error, count } = await query;
    if (error) throw new Error(`Loading recipes failed: ${error.message}`);
    return { rows: (data ?? []) as RecipeRow[], total: count };
  }, PAGE_SIZE);
}

function pairsFor(recipes: RecipeRow[]): Pair[] {
  return recipes.flatMap((recipe) => {
    const proteins = recipe.main_proteins.filter(isProtein) as Protein[];
    return conflictingDiets(proteins)
      .filter((diet) => !args.diet || diet === args.diet)
      .map((diet) => ({ recipe, diet }));
  });
}

async function storedStatuses(): Promise<Map<string, string>> {
  const { data, error } = await db.from("recipe_protein_swaps").select("recipe_id, diet, status").eq("locale", "lt");
  if (error) throw new Error(`Loading stored swaps failed: ${error.message}`);
  return new Map((data ?? []).map((row) => [`${row.recipe_id}/${row.diet}`, row.status as string]));
}

function formatAmount(amount: number | null, unit: string | null): string {
  return amount === null ? "pagal skonį" : `${amount} ${unit}`;
}

function reportSection(pair: Pair, result: GetSwapResult): string {
  const title = `### ${pair.recipe.name} (${pair.diet})`;
  if (result.status !== "ready") {
    const detail = result.status === "unavailable" ? `, retry after ${result.retryAfter.toISOString()}` : "";
    return `${title}\n\n**No swap: ${result.status}${detail}**\n`;
  }
  const swap: ProteinSwapView = result.swap;
  const rows = swap.items.map(
    (item) =>
      `| ${item.position} | ${item.original.item}, ${formatAmount(item.original.amount, item.original.unit)} | ` +
      `${item.item}, ${formatAmount(item.amount, item.unit)} | ${item.replacementProtein} |`,
  );
  const kcal = swap.nutrition?.caloriesKcal ?? "dropped (implausible or missing)";
  return [
    title,
    "",
    "| # | Original | Swap | Protein |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
    `Note: ${swap.note ?? "none"}. Nutrition (approximate): ${pair.recipe.calories_kcal ?? "?"} kcal -> ${kcal} kcal.`,
    "",
  ].join("\n");
}

async function main(): Promise<void> {
  const recipes = await loadRecipes();
  const pairs = pairsFor(recipes);

  if (args["dry-run"]) {
    const statuses = await storedStatuses();
    for (const pair of pairs) {
      const status = statuses.get(`${pair.recipe.id}/${pair.diet}`) ?? "missing";
      console.info(`${status.padEnd(8)} ${pair.diet.padEnd(10)} ${pair.recipe.name} (${pair.recipe.id})`);
    }
    console.info(`${pairs.length} pairs`);
    return;
  }

  const service = createProteinSwapService({
    store: createSupabaseSwapStore(db),
    ai: () =>
      createGeminiClient({
        apiKey: requireEnv("NUXT_GEMINI_API_KEY"),
        model: process.env.NUXT_GEMINI_MODEL || "gemini-flash-latest",
        baseUrl: process.env.NUXT_GEMINI_BASE_URL || undefined,
      }),
  });

  const results: { pair: Pair; result: GetSwapResult }[] = [];
  let next = 0;
  const worker = async () => {
    while (next < pairs.length) {
      const pair = pairs[next++]!;
      let result: GetSwapResult;
      try {
        result = await service.getOrCreateSwap(pair.recipe.id, pair.diet);
      } catch (error) {
        console.error(JSON.stringify({ event: "protein_swap.backfill_error", recipeId: pair.recipe.id, diet: pair.diet, error: String(error) }));
        result = { status: "unavailable", retryAfter: new Date() };
      }
      const generated = result.status === "ready" && result.generated ? " (generated)" : "";
      console.info(`${result.status}${generated}: ${pair.recipe.name} / ${pair.diet}`);
      results.push({ pair, result });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pairs.length) }, worker));

  results.sort((a, b) => a.pair.recipe.name.localeCompare(b.pair.recipe.name, "lt") || a.pair.diet.localeCompare(b.pair.diet));
  const missing = results.filter(({ result }) => result.status !== "ready");
  const report = [
    "# Protein swap review",
    "",
    `${results.length} pairs, ${results.length - missing.length} with a swap, ${missing.length} without.`,
    "",
    ...results.map(({ pair, result }) => reportSection(pair, result)),
  ].join("\n");
  await writeFile(REPORT_PATH, report);

  console.info(`${results.length - missing.length}/${results.length} pairs have a swap; review in ${REPORT_PATH}`);
  if (missing.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
