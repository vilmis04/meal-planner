/*
 * Makes the protein swaps (D2) and their translations (X1c): for every recipe and each diet it conflicts with, the
 * Lithuanian swap is generated once and then translated once into every other language (English), both stored. Pairs
 * already stored are read, not asked for again, so a run only pays for what is missing; this is also how swaps stored
 * before X1c get their English. The app never calls the AI for a swap: until this has run, a pair without a swap shows
 * "not ready" and an untranslated one shows in Lithuanian. Run it after a deploy that adds recipes or changes their
 * ingredients or the swap prompt, and after rejecting swaps.
 *
 *   npm run swaps:generate                      all missing swaps and translations
 *   npm run swaps:generate -- --dry-run         list pairs, their stored status and languages, call nothing
 *   npm run swaps:generate -- --recipe <uuid> --diet vegetarian
 *
 * Reads NUXT_PUBLIC_SUPABASE_URL, NUXT_SUPABASE_SERVICE_ROLE_KEY, NUXT_GEMINI_API_KEY and optionally
 * NUXT_GEMINI_MODEL / NUXT_GEMINI_BASE_URL from .env. Writes a review report (swap-review.md) and exits 1
 * when any pair is still without a swap or a translation.
 */
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { DIETS, isProtein } from "../shared/utils/diet";
import type { Protein } from "../shared/utils/diet";
import { fetchAllPages } from "../shared/utils/fetchAllPages";
import { SWAP_TRANSLATION_LOCALES, conflictingDiets } from "../shared/utils/proteinSwap";
import type { ProteinSwapView } from "../shared/utils/proteinSwap.types";
import { createGeminiClient } from "../server/utils/ai/gemini";
import { createProteinSwapReader, createProteinSwapService } from "../server/utils/proteinSwapService";
import type { GetSwapResult, TranslateSwapResult } from "../server/utils/proteinSwapService.types";
import { createSupabaseSwapStore } from "../server/utils/proteinSwapStore";
import { storedSwapStatusRowsSchema } from "./generate-protein-swaps.schema";
import type { PairResult, Pair, RecipeRow } from "./generate-protein-swaps.types";

const CONCURRENCY = 2;
const PAGE_SIZE = 1000;
const REPORT_PATH = "swap-review.md";

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

// "ready (lt, en)": each pair's stored status and the languages it is stored in.
async function storedStatuses(): Promise<Map<string, string>> {
  const { data, error } = await db
    .from("recipe_protein_swaps")
    .select("recipe_id, diet, status, recipe_protein_swap_translations(locale)")
    .eq("locale", "lt");
  if (error) throw new Error(`Loading stored swaps failed: ${error.message}`);
  return new Map(
    storedSwapStatusRowsSchema.parse(data).map((row) => {
      const locales = row.recipe_protein_swap_translations.map((translation) => translation.locale).sort();
      return [`${row.recipe_id}/${row.diet}`, `${row.status} (${locales.join(", ")})`];
    }),
  );
}

const isTranslated = (result: TranslateSwapResult) => result.status === "translated" || result.status === "present";

function formatAmount(amount: number | null, unit: string | null): string {
  return amount === null ? "pagal skonį" : `${amount} ${unit}`;
}

const translatedItem = (item: ProteinSwapView["items"][number], locale: string) =>
  item.texts.find((text) => text.locale === locale)?.item ?? "**not translated**";

function reportSection({ pair, result, swap, translations }: PairResult): string {
  const title = `### ${pair.recipe.name} (${pair.diet})`;
  if (result.status !== "ready" || !swap) {
    const detail = result.status === "unavailable" ? `, retry after ${result.retryAfter.toISOString()}` : "";
    return `${title}\n\n**No swap: ${result.status}${detail}**\n`;
  }
  const languages = SWAP_TRANSLATION_LOCALES.map((locale) => locale.toUpperCase());
  const rows = swap.items.map(
    (item) =>
      `| ${item.position} | ${item.original.item}, ${formatAmount(item.original.amount, item.original.unit)} | ` +
      `${item.item}, ${formatAmount(item.amount, item.unit)} | ` +
      SWAP_TRANSLATION_LOCALES.map((locale) => `${translatedItem(item, locale)} | `).join("") +
      `${item.replacementProtein} |`,
  );
  const notes = SWAP_TRANSLATION_LOCALES.map((locale) => {
    const translated = swap.notes.find((note) => note.locale === locale);
    const outcome = translations.find((translation) => translation.locale === locale)?.result;
    const text = translated ? (translated.note ?? "none") : "**not translated**";
    return `- Note (${locale.toUpperCase()}): ${text}${outcome?.status === "failed" ? ` (${outcome.error})` : ""}`;
  });
  const kcal = swap.nutrition?.caloriesKcal ?? "dropped (implausible or missing)";
  return [
    title,
    "",
    `| # | Original | Swap | ${languages.join(" | ")} | Protein |`,
    `| --- | --- | --- | ${languages.map(() => "---").join(" | ")} | --- |`,
    ...rows,
    "",
    `- Note: ${swap.note ?? "none"}`,
    ...notes,
    `- Nutrition (approximate): ${pair.recipe.calories_kcal ?? "?"} kcal -> ${kcal} kcal`,
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

  const store = createSupabaseSwapStore(db);
  const reader = createProteinSwapReader({ store });
  const service = createProteinSwapService({
    store,
    ai: () =>
      createGeminiClient({
        apiKey: requireEnv("NUXT_GEMINI_API_KEY"),
        model: process.env.NUXT_GEMINI_MODEL || "gemini-flash-latest",
        baseUrl: process.env.NUXT_GEMINI_BASE_URL || undefined,
      }),
  });

  const results: PairResult[] = [];
  let next = 0;
  const worker = async () => {
    while (next < pairs.length) {
      const pair = pairs[next++]!;
      let result: GetSwapResult;
      const translations: PairResult["translations"] = [];
      let swap: ProteinSwapView | null = null;
      try {
        result = await service.getOrCreateSwap(pair.recipe.id, pair.diet);
        if (result.status === "ready") {
          for (const locale of SWAP_TRANSLATION_LOCALES) {
            translations.push({ locale, result: await service.translateSwap(pair.recipe.id, pair.diet, locale) });
          }
          // Read back as the app reads it, with every language now stored.
          const stored = await reader.readSwap(pair.recipe.id, pair.diet);
          swap = stored.status === "ready" ? stored.swap : result.swap;
        }
      } catch (error) {
        console.error(JSON.stringify({ event: "protein_swap.backfill_error", recipeId: pair.recipe.id, diet: pair.diet, error: String(error) }));
        result = { status: "unavailable", retryAfter: new Date() };
      }
      const generated = result.status === "ready" && result.generated ? " (generated)" : "";
      const translated = translations.map(({ locale, result: outcome }) => `, ${locale} ${outcome.status}`).join("");
      console.info(`${result.status}${generated}${translated}: ${pair.recipe.name} / ${pair.diet}`);
      results.push({ pair, result, swap, translations });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pairs.length) }, worker));

  results.sort((a, b) => a.pair.recipe.name.localeCompare(b.pair.recipe.name, "lt") || a.pair.diet.localeCompare(b.pair.diet));
  const missing = results.filter(({ result }) => result.status !== "ready");
  const untranslated = results.filter(({ translations }) => translations.some(({ result }) => !isTranslated(result)));
  const report = [
    "# Protein swap review",
    "",
    `${results.length} pairs, ${results.length - missing.length} with a swap, ${missing.length} without; ` +
      `${untranslated.length} with a swap not translated into every language.`,
    "",
    ...results.map(reportSection),
  ].join("\n");
  await writeFile(REPORT_PATH, report);

  console.info(
    `${results.length - missing.length}/${results.length} pairs have a swap, ${untranslated.length} not fully ` +
      `translated; review in ${REPORT_PATH}`,
  );
  if (missing.length > 0 || untranslated.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
