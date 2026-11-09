# Architecture Plan

How the Meal Planner is built and run. Product scope is in [product-description.md](product-description.md), tasks in [user-stories.md](user-stories.md), sequencing in [roadmap.md](roadmap.md).

## 1. Principles

- **Small and boring.** One deployable app, one database. No extra services until a story needs them.
- **The database is the source of truth for access.** Household and ownership rules are enforced by Postgres row level security (RLS), not only by app code.
- **Pure core logic.** Plan generation, quantity scaling and list merging are plain TypeScript modules with no framework or database imports, so they are easy to test.
- **AI stays at the edge.** AI is called only from the server, only for protein swaps (D2) and optional plan polish (I3), and results are cached in the database.
- **Everything is reproducible.** Schema changes are SQL migrations in the repo; deploys are automatic from Git.

## 2. System overview

```
 Browser (phone-first PWA-ready)
    |  HTTPS
    v
 Coolify (self-hosted): reverse proxy + TLS
    |
    v
 Nuxt 4 app container (Nitro node-server)
    |-- SSR pages + Vuetify UI
    |-- server/api/*  (plan generation, swaps, scheduled jobs)
    |-- server middleware: Supabase session from cookies
    |            |                       \
    |            v                        v
    |     Supabase (Postgres + Auth +     Gemini API
    |     Realtime, RLS, pg_cron)         (server-side only)
    v
 Browser <-- Supabase Realtime (shared shopping list)
```

Components:

| Component | Role | Notes |
|---|---|---|
| Nuxt 4 / Nitro (`node-server` preset) | SSR, UI, server API routes | Exists. Built by the repo `Dockerfile` (multi-stage, node 20 alpine, non-root). |
| Vuetify + CSS Modules | UI components and layout | Exists. Mobile-first breakpoints; themes light/dark via tokens. |
| Supabase Postgres | All data, RLS, migrations | Exists (recipes, ingredients, tips). |
| Supabase Auth | Email/password login, sessions | Exists; server middleware reads the session via `@supabase/ssr`. |
| Supabase Realtime | Live updates of shared shopping lists | New (G6). |
| Coolify | Build, deploy, TLS, env vars, scheduled tasks, logs | Self-hosted. |
| Gemini API (Google) | Protein swaps, plan polish, one-off recipe translation | New, server-side only. |

## 3. Hosting on self-hosted Coolify

- **Application:** one Coolify application from the Git repo, Dockerfile build pack, port 3000, domain with automatic TLS, Git webhook for deploy on push to `main`. This is the current setup.
- **Environments:** a `production` and a `staging` application in Coolify, each with its own Supabase project (or database) and its own env vars. Pull requests can use Coolify preview deployments if Supabase credentials for a non-production project are supplied.
- **Configuration:** runtime env vars only (never baked into the image): `NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_ANON_KEY`, `NUXT_SUPABASE_SERVICE_ROLE_KEY` (secret), plus new `NUXT_GEMINI_API_KEY` (secret) and `NUXT_CRON_SECRET` (secret, for scheduled endpoints). Mapped through `runtimeConfig`, public values only where the browser needs them.
- **Health:** add `/api/health` (app up, DB reachable) and configure it as the Coolify health check so a bad deploy is not switched in.
- **Scaling:** one container is enough for the expected load (households, not the public internet). The app is stateless (sessions in cookies, data in Supabase), so it can run multiple replicas later without changes.
- **Logs and alerts:** container logs in Coolify; deploy and health-check failure notifications through Coolify's notification channels. Add structured server logs (JSON) in API routes and the scheduled job.
- **Backups:** if Supabase is self-hosted on the same Coolify server, schedule database backups to external storage (S3-compatible) and test restores. If Supabase cloud is used, rely on its backups and still export periodically. Decision point in section 9.
- **Region/latency:** keep Coolify and Supabase close to each other, since SSR makes DB and auth calls on every request (already noted in the README).

## 4. Application structure

```
app/
  pages/            routes (plans, lists, recipes, household, settings)
  components/       UI, grouped by feature
  composables/      client state and data access (useRecipes, usePlan, useShoppingList...)
  layouts/          responsive shell (bottom nav on phones, side nav on desktop)
  locales/          lt.json, en.json (all UI strings by key)
  middleware/       auth guard
server/
  api/              thin HTTP handlers: validate input, call domain code, return JSON
  middleware/       Supabase session per request
  tasks/ or api/cron/  scheduled plan creation (H2)
  utils/            Supabase and AI (Gemini) clients
shared/ (or domain/)
  planner/          plan generator (pure)
  shopping/         scaling, unit conversion, merging (pure; unit rules in shared/utils/ingredientUnit.ts, G1; the list in shared/utils/shoppingList.ts, G2)
  diet/             diet ladder and compatibility (pure)
  nutrition/        per-day totals and averages (pure; shared/utils/nutrition.ts, F1)
supabase/
  migrations/       schema, RLS, seeds, translations
```

Rules:
- Pages and composables talk to Supabase directly for simple reads and writes (RLS protects them). Server API routes are used only when logic must not run in the browser: plan generation, anything using the service role or an AI key, scheduled jobs.
- The `shared/` pure modules are used by both the server (scheduled generation) and the client (instant preview), and are the main target of unit tests.
- Server routes validate input (schema validation) and check household membership explicitly before using the service role.

## 5. Data and security

- **Migrations:** SQL files in `supabase/migrations`, applied by the Supabase CLI in CI or by a manual deploy step per environment. Never edit the database by hand in production.
- **RLS by area:**
  - Content tables (recipes, ingredients, tips, translations, swaps): readable by any signed-in user, writable only by the service role (as today).
  - `profiles`: owner can read/update their row; household members can read names.
  - Households and members: members can read their household; only the owner can change membership.
  - Plans, slots, participants, lists, items: household plans accessible to household members; individual plans only to their owner. Policies use a `is_household_member(household_id)` helper function (security definer) to avoid recursive policies.
  - Schedules (H1): readable like the owner's plans (the person, or the household's members); saved through a function, by the household's owner for a household.
  - Preferences: owner only; the generator reads participants' preferences on the server after verifying the caller is in the household.
  - Purchases and shops: shops are household scoped (or the person's own without a household); a purchase is readable with its shopping list (G7).
- **Service role key** is used only in server code, never exposed to the client, and only after an explicit authorisation check.
- **Invites:** random single-use tokens stored hashed, with expiry; accepting is a server function.
- **Secrets:** only in Coolify env vars. `.env.example` lists names without values.
- **Rate limiting:** basic limits on invite acceptance, login-adjacent endpoints and AI routes (in the app or at the Coolify proxy).

## 6. Key flows

**Generate a plan (E4).** Client calls `POST /api/plans/:id/generate` -> server verifies membership -> loads participants, their diets and preferences, recipes with protein metadata and swaps, and recent plan history (for cooldown) -> pure `planner` returns slot assignments -> server writes slots -> shopping list is built by the pure `shopping` module and stored -> client shows the result. Same code is used by the scheduled job.

**Lock, swap, regenerate (E5).** Locks are a slot column changed through `set_meal_plan_slots_locked()` (a recipe chosen by hand is locked). "Regenerate unlocked" is the same generate call with `mode: "regenerate_unlocked"`; a swap (`POST /api/plans/:id/slots/:slotId/swap`) runs the same pure planner on one slot (or its batch) with every other slot kept and the current recipe excluded. Every write names the recipe each slot held when it was read, so a change made meanwhile refuses the write (`plan_changed`) instead of being overwritten.

**Plan overview and history (E6).** The plan list asks Postgres for current and upcoming plans (`end_date >= today`) and pages through past ones (`end_date < today`); `end_date` is a generated column and "today" is the viewer's date, so the server never decides what is past. Row level security alone decides which plans are listed. The week view and the picker filters are computed in the browser from data the viewer can already read (own ratings, members' diets, visible plans); no new function exposes anyone's ratings or individual plans.

**Plans side by side (E7).** An individual plan for days a household plan also covers is an ordinary plan; the database neither links nor forbids them. The plan page reads the overlapping plans the viewer can already see and decides in the browser what to say about them (`getPlanAlongside()`); the New plan screen is prefilled from its address. Each plan keeps its own participants, so each will get its own shopping list.

**Nutrition on request (F1).** Hidden until the user turns on "Show nutrition", which is stored on the profile (`profiles.show_nutrition`). Only then does the browser read the library's macros (one paged read, like the recipe list) and the ready protein swaps' estimates for the plan's recipes and its participants' diets; row level security already allowed both. The pure `nutrition` module turns them into per-meal values, day totals and the daily average for the participant the viewer picks, leaving recipes with incomplete macros out of the totals.

**Ingredient canonicalisation (G1).** Recipes keep their free-text items. `ingredient_aliases` maps each item, spelled exactly as written, to a canonical `ingredients` row with its shopping category; the mapping is a reviewed migration, and anything without an alias (a new seed item, or a protein swap replacement the AI named) shows up in `unmapped_ingredient_items` and the mapping report instead of being guessed. The list (G2) merges by ingredient and base unit (`toBaseQuantity()`: kg to g, l to ml; pieces and other units on their own).

**Shopping list from the plan (G2).** Each plan gets its `shopping_lists` row when it is created. Triggers move the list's `source_version` whenever its inputs change (slot recipes, participants, snack options, a participant's diet, a protein swap becoming ready), so the database itself knows when a list is out of date, whatever wrote the change. Opening the list calls `POST /api/plans/:id/shopping-list`, which rebuilds it only then: the pure `shopping` module (`buildShoppingList()`) scales each participant's portion (with their ready protein swap) and merges by canonical ingredient and base unit, and `apply_shopping_list_generation()` writes it against the version it was built from (`list_changed` otherwise, and the server builds again). A rebuild writes only the generated columns of `shopping_items` and keeps lines people changed, so G4/G5 edits survive; everything runs as the signed-in user. Open lists hear a moved `source_version` through Realtime and rebuild themselves (G6).

**Categorised list view (G3).** The list's groups and their counts come from the pure `getShoppingListView()`; the order is `INGREDIENT_CATEGORIES` (a walk through a shop) and then the extras. Which groups are open is a per-viewer convenience, so it lives in the browser's `localStorage` per list (not in the database and not shared through Realtime), and the server always renders every group open.

**Changing the list (G4).** People never write `shopping_items` directly: security definer functions (`add_shopping_item()`, `set_shopping_item_amount()`, `set_shopping_item_state()`, `remove_shopping_item()`, `restore_shopping_item()`) check `can_access_shopping_list()`, lock the one row they change and write only its own fields, so the rebuild's generated columns and people's columns stay apart and two people's changes to different lines cannot collide. A change to a generated line's amount is an override that wins over later plan amounts (the page shows the plan's amount next to it); a removed generated line is only marked removed, so a rebuild cannot bring it back; a removed manual line is deleted. The page applies each change at once and puts back only the fields it changed when the database refuses.

**Bought items (G5).** Ticking a line bought is `set_shopping_item_state(…, 'bought')`, the same one-row, one-field change as "at home", so it needs no new function and a rebuild keeps it. The page sends one line's calls in order, so quick taps cannot arrive reversed. Progress ("12 of 31 bought") and the bought-last order are computed in the browser by `getShoppingListView()`; whether bought lines go last is a per-viewer convenience in `localStorage`. The page's `handleToggleBought()` is the single place a tick happens; G7 records the shop there.

**Shared shopping list (G6).** `shopping_lists` and `shopping_items` are in the `supabase_realtime` publication (`20261116000000_add_shopping_list_realtime.sql`). The list page (`useShoppingListLive()`) subscribes to Realtime `postgres_changes` for its own list: lines added or changed (`list_id=eq.<id>`), any line deleted (a deleted row arrives as its id only and cannot be filtered or checked against RLS, so unknown ids are ignored), and its list row. Realtime checks each change against the subscriber's SELECT policies, so only people who can open the plan hear it; nothing about access changed. Every edit is still one locked row and its own fields (G4), so concurrent edits to different lines, or different fields of one line, never overwrite each other; on the same field the later write wins. Payloads are validated with zod and merged by pure functions (`shoppingListLiveMerge.ts`): fields the viewer has on the way keep the viewer's value until the database's echo arrives (`createShoppingItemFieldGuards()`), so a late or stale change never flicks a pending tick back. When the list row says the plan moved ahead (`source_version > generated_version`) the page rebuilds the list as on opening it. Changes missed while not subscribed are caught up by reading the list again on every (re)subscription and when the tab becomes visible; changes that arrive during a read are applied again on top of it. The header shows "Live" or "Reconnecting…". Presence ("Monika is shopping") is not built: it needs private channels with Realtime Authorization.

**Record the shop (G7).** A bought line has one `purchases` row (key: the line), written by `set_shopping_item_state()` in the same call that ticks it and deleted in the same call that unticks it, so state and purchase never disagree. The shop is optional and given by name: `find_or_add_shop()` finds it by `name_key` in the caller's household (or the caller's own shops without one) or adds it, with the id the app suggested; `set_shopping_item_shop()` changes it later. The purchase keeps the amount the line said to buy, so the page can say when the plan later needs more. Purchases are published to Realtime and merged into the page's lines like the lines' own fields (guarded while on the way); shops are not published, and the page reads them again when a purchase names one it does not know. The shop the viewer is shopping at is a per-tab convenience in `sessionStorage`, not shared.

**Schedule settings (H1).** `plan_schedules` holds one schedule per person and one per household (weekday to create on, weekday the plan starts on, length, snacks on the list, everyone or the chosen members in `plan_schedule_participants`, and the IANA time zone of whoever saved it last). It is read under the same rules as plans and written only through `save_plan_schedule()` (the household's owner for the household's). `getScheduleRun()` in `shared/utils/planSchedule.ts` turns a schedule and a date into the run day and the plan's days; the settings screen previews the next run with it.

**Scheduled plan creation (H2).** Coolify scheduled task (or Supabase `pg_cron` with `pg_net`) calls `POST /api/cron/create-plans` daily with `Authorization: Bearer <NUXT_CRON_SECRET>` (constant-time check). The endpoint reads the enabled schedules as the service role, finds those due today on their own `time_zone` clock (`getScheduleRun(schedule, getDateInTimeZone(timeZone, now)).runDate === localToday`), and for each one: `create_scheduled_meal_plan()` makes the plan idempotently (`meal_plans.schedule_id`, unique on schedule + `start_date`; a plan already there is returned untouched), the same `generatePlan()` as E4 fills it and the same `refreshShoppingList()` as G2 builds its list, through service-role stores that write with `write_meal_plan_generation()` / `write_shopping_list_generation()` (the user-facing `apply_` functions are now their access check plus these writes). Each schedule stands alone: a failure is logged as a JSON line and reported in the response (500 when any failed) while the others go on; unreadable schedules or missing configuration fail the whole run first. Missed run days are not caught up. Failures are kept in the logs only, not in a table. H3 writes the notification rows from the `created` results. Chosen default: Coolify scheduled task, because it keeps all deployment config in one place.

**AI protein swaps (D2).** On demand: the first request for a recipe and diet (`GET /api/recipes/:id/swaps/:diet`, or E4 on the server) claims the pair in `recipe_protein_swaps`, calls the Gemini API once, validates the structured output (ingredient exists, replacement fits the diet) and stores it per language. Every later request reads the stored row, so each pair costs one AI call; concurrent first requests make one call between them, and failed pairs retry after a growing wait. An optional backfill script (`npm run swaps:generate`) fills all pairs ahead of time through the same service.

**Translations (X1, X1b).** UI strings come from `locales/*.json` through the i18n module; recipe content is read from translation tables joined on the active locale with LT fallback.

## 7. Cross-cutting concerns

- **i18n:** Nuxt i18n module, LT and EN, locale in cookie then profile. CI check for missing keys.
- **Theming:** existing Vuetify themes plus CSS tokens; cookie read during SSR to avoid a flash.
- **Responsive/mobile-first:** shared layout shell and breakpoints; consider making the app installable (PWA manifest, offline-tolerant shopping list view) as a later improvement, since shopping happens in stores with weak signal.
- **Performance:** recipes are static-ish, so cache reads (HTTP cache headers or in-memory with short TTL); paginate and index by `meal_type`; generation loads only candidate recipes.
- **Accessibility:** Vuetify defaults, 44 px targets, contrast checked in both themes.
- **Observability:** structured logs, health endpoint, error tracking (optional self-hosted tool such as GlitchTip or Sentry on Coolify).
- **Privacy:** data is personal (diet, preferences). Minimise it, document what is stored, support account and household deletion (cascade), and send only recipe/diet text, never personal identifiers, to the AI provider (Gemini free-tier data may be used for product improvement, so this matters).

## 8. Testing and CI/CD

- **Unit tests (Vitest)** for the pure modules: planner (fixed seeds), cooldown, scaling and merging, diet compatibility, nutrition averages.
- **Database tests** for RLS (pgTAP or SQL scripts through the Supabase CLI): a member sees household data, an outsider does not, individual plans stay private.
- **Component/e2e tests (Playwright)** for the main journeys: login, create household, create plan, tick items on the list, at phone and desktop widths and in both themes.
- **CI** (GitHub Actions): install, lint, type check, unit tests, build and a migration dry run on pull requests. Coolify deploys on merge to `main`; migrations are applied before or as part of the deploy (decision in section 9).
- **Definition of done** adds: translation keys in both languages, both themes, phone and desktop checked, RLS policy for any new table.

## 9. Decisions and open questions

| # | Question | Default taken |
|---|---|---|
| 1 | Supabase cloud or self-hosted on Coolify? | Keep Supabase cloud for now (matches current README); self-hosting is possible later and needs a backup plan (section 3). |
| 2 | How are migrations applied on deploy? | Supabase CLI run from CI against staging and then production after a manual approval. |
| 3 | Scheduled job runner | Coolify scheduled task calling a secret-protected endpoint; `pg_cron` if timing needs to be independent of the app. |
| 4 | i18n library | Nuxt i18n. |
| 5 | Testing stack | Vitest, Playwright, SQL tests for RLS. |
| 6 | Where does plan generation run? | Server API route using pure shared modules (also usable client-side for previews). |
| 7 | AI provider and key handling | Google Gemini API (free tier suits the low, one-off volume; paid tier if limits bite). Wrapped behind a small `ai` module so the provider can be swapped. Key as Coolify secret, server-side only, outputs cached. Note: free-tier prompts may be used by Google to improve its products, so send only recipe text. |
| 8 | Error tracking | Optional; self-hosted tool on Coolify when needed. |
| 9 | Email (invites, password reset, notifications) | Supabase Auth mail for auth; configure SMTP for production. Other notifications are in-app for now. |

## 10. Mapping to the roadmap

| Phase | Architecture work |
|---|---|
| 1 | CI, tests setup, i18n foundation, responsive shell, `/api/health`, staging environment in Coolify, profile/household tables and RLS helper functions. |
| 2 | Plan, list and preference tables with RLS, `shopping` pure module, ingredient canonicalisation and translation tables. |
| 3 | `planner` module and generate endpoint, Realtime for lists. |
| 4 | Gemini integration and swap batch script, scheduled job endpoint, notification table. |
| 5 | Insight queries/views, optional PWA install and offline list view. |
