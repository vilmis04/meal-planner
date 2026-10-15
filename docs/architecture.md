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
    |     Supabase (Postgres + Auth +     Anthropic API
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
| Anthropic API | Protein swaps, plan polish, one-off recipe translation | New, server-side only. |

## 3. Hosting on self-hosted Coolify

- **Application:** one Coolify application from the Git repo, Dockerfile build pack, port 3000, domain with automatic TLS, Git webhook for deploy on push to `main`. This is the current setup.
- **Environments:** a `production` and a `staging` application in Coolify, each with its own Supabase project (or database) and its own env vars. Pull requests can use Coolify preview deployments if Supabase credentials for a non-production project are supplied.
- **Configuration:** runtime env vars only (never baked into the image): `NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_ANON_KEY`, `NUXT_SUPABASE_SERVICE_ROLE_KEY` (secret), plus new `NUXT_ANTHROPIC_API_KEY` (secret) and `NUXT_CRON_SECRET` (secret, for scheduled endpoints). Mapped through `runtimeConfig`, public values only where the browser needs them.
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
  utils/            Supabase and Anthropic clients
shared/ (or domain/)
  planner/          plan generator (pure)
  shopping/         scaling, unit conversion, merging (pure)
  diet/             diet ladder and compatibility (pure)
  nutrition/        per-day totals and averages (pure)
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
  - Preferences: owner only; the generator reads participants' preferences on the server after verifying the caller is in the household.
  - Purchases and stores: household scoped.
- **Service role key** is used only in server code, never exposed to the client, and only after an explicit authorisation check.
- **Invites:** random single-use tokens stored hashed, with expiry; accepting is a server function.
- **Secrets:** only in Coolify env vars. `.env.example` lists names without values.
- **Rate limiting:** basic limits on invite acceptance, login-adjacent endpoints and AI routes (in the app or at the Coolify proxy).

## 6. Key flows

**Generate a plan (E4).** Client calls `POST /api/plans/:id/generate` -> server verifies membership -> loads participants, their diets and preferences, recipes with protein metadata and swaps, and recent plan history (for cooldown) -> pure `planner` returns slot assignments -> server writes slots -> shopping list is built by the pure `shopping` module and stored -> client shows the result. Same code is used by the scheduled job.

**Shared shopping list (G6).** Items live in `shopping_items` rows. Clients subscribe to Realtime changes for the list id; each toggle or edit is a single-row update, so concurrent edits to different items do not conflict. Last write wins on the same item.

**Scheduled plan creation (H2).** Coolify scheduled task (or Supabase `pg_cron` with `pg_net`) calls `POST /api/cron/create-plans` daily with `NUXT_CRON_SECRET`. The endpoint finds schedules due today in each user's/household's timezone, creates plans idempotently (unique key on schedule + period start), generates them, and writes a notification row. Chosen default: Coolify scheduled task, because it keeps all deployment config in one place.

**AI protein swaps (D2).** An admin/batch script (run locally or as a one-off Coolify command) calls the Anthropic API per recipe and diet, validates the structured output (ingredient exists, replacement fits the diet), and stores it in `recipe_protein_swaps` per language. The UI only reads the table, so there is no AI call or cost at view time.

**Translations (X1, X1b).** UI strings come from `locales/*.json` through the i18n module; recipe content is read from translation tables joined on the active locale with LT fallback.

## 7. Cross-cutting concerns

- **i18n:** Nuxt i18n module, LT and EN, locale in cookie then profile. CI check for missing keys.
- **Theming:** existing Vuetify themes plus CSS tokens; cookie read during SSR to avoid a flash.
- **Responsive/mobile-first:** shared layout shell and breakpoints; consider making the app installable (PWA manifest, offline-tolerant shopping list view) as a later improvement, since shopping happens in stores with weak signal.
- **Performance:** recipes are static-ish, so cache reads (HTTP cache headers or in-memory with short TTL); paginate and index by `meal_type`; generation loads only candidate recipes.
- **Accessibility:** Vuetify defaults, 44 px targets, contrast checked in both themes.
- **Observability:** structured logs, health endpoint, error tracking (optional self-hosted tool such as GlitchTip or Sentry on Coolify).
- **Privacy:** data is personal (diet, preferences). Minimise it, document what is stored, support account and household deletion (cascade), and send only recipe/diet text, never personal identifiers, to the AI provider.

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
| 7 | AI provider and key handling | Anthropic API, key as Coolify secret, server-side only, outputs cached. |
| 8 | Error tracking | Optional; self-hosted tool on Coolify when needed. |
| 9 | Email (invites, password reset, notifications) | Supabase Auth mail for auth; configure SMTP for production. Other notifications are in-app for now. |

## 10. Mapping to the roadmap

| Phase | Architecture work |
|---|---|
| 1 | CI, tests setup, i18n foundation, responsive shell, `/api/health`, staging environment in Coolify, profile/household tables and RLS helper functions. |
| 2 | Plan, list and preference tables with RLS, `shopping` pure module, ingredient canonicalisation and translation tables. |
| 3 | `planner` module and generate endpoint, Realtime for lists. |
| 4 | Anthropic integration and swap batch script, scheduled job endpoint, notification table. |
| 5 | Insight queries/views, optional PWA install and offline list view. |
