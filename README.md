# Meal Planner

Nuxt 4 app deployed to a self-hosted Coolify instance, using Supabase for the database and auth, Vuetify as the component library, and CSS Modules for page/layout structure.

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env` with your Supabase project's URL, anon key, and service role key from the Supabase dashboard (Project Settings → API).

## Development Server

```bash
npm run dev
```

Runs on `http://localhost:3000`.

## Linting

```bash
npm run lint       # ESLint via @nuxt/eslint (config in eslint.config.mjs)
npm run lint:fix   # apply auto-fixes
```

Vue single-file components put `<script>` first, then `<template>`, then `<style>` (`vue/block-order`).

## Production

```bash
npm run build      # Nitro build for the node-server preset
npm start          # serve .output/server/index.mjs on port 3000
```

### Deploying on Coolify

1. Create a new application from this Git repository and choose the **Dockerfile** build pack.
2. Set the exposed port to `3000` and attach your domain (Coolify provisions TLS).
3. Add these environment variables as runtime variables:
   - `NUXT_PUBLIC_SUPABASE_URL`
   - `NUXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NUXT_SUPABASE_SERVICE_ROLE_KEY` (mark as secret, never expose to the client)
4. Enable the Git webhook for automatic deploys.

Place the Coolify server in the same region as the Supabase project to keep SSR auth/DB calls fast.

## Database migrations

Keep every schema change as SQL in `supabase/migrations/` so the database can be replayed on any Supabase instance (managed or self-hosted). Avoid dashboard-only changes.

## Styling conventions

- **Vuetify** components (`v-btn`, `v-card`, form inputs, etc.) own look and feel.
- **CSS Modules** (`<style module>` in SFCs, or `Component.module.css` files) own page/layout structure — grids, containers, spacing wrappers.
- Shared design tokens live in `app/assets/css/tokens.css` (spacing, radii, breakpoints) and `app/assets/css/theme.css` (color custom properties). Colors are defined only in the `vuetify.vuetifyOptions.theme` block in `nuxt.config.ts`; Vuetify writes the active theme to `--v-theme-*` variables on `:root`, and `theme.css` aliases them as `--color-*` for CSS-Modules layout code. Add a new color to both themes in `nuxt.config.ts`, then alias it in `theme.css`.
- The theme preference is `light`, `dark` or `system`. Change it through `useProfileSettings().changeTheme()` (saves to the profile when signed in). `useAppTheme()` keeps it in a `theme` cookie that `app/plugins/theme.ts` applies during the server render; for `system` the server uses the OS theme the browser last reported (`theme-system` cookie), so Vuetify's `:root` variables already match and there is no flash of the wrong theme.

## Auth

Auth uses Supabase's `@supabase/ssr` cookie-based session pattern:

- `server/middleware/supabase.ts` creates a per-request Supabase server client, refreshes the session, and exposes it via `event.context.supabase` / `event.context.supabaseUser`.
- `app/plugins/supabase.client.ts` creates the browser client and keeps `useSupabaseUser()` in sync via `onAuthStateChange`.
- `app/middleware/auth.global.ts` runs on every route: signed-out users go to `/login`, signed-in users visiting `/login` go to `/`.
- `app/middleware/auth.global.ts` also treats `/forgot-password` as guest-only, and sends signed-out visitors of `/reset-password` to `/forgot-password`.
- `/login` has Sign in and Create account tabs (email + password), a "Forgot password?" link and a "Continue with Google" button. Supabase errors are mapped to translation keys in `app/utils/getAuthErrorKey.ts`.
- `/forgot-password` sends a Supabase reset email; `/reset-password` sets the new password once the reset link has signed the user in.
- Every auth screen honours `?next=<same-origin path>` (validated by `shared/utils/getSafeNextPath.ts`): the auth guard sends signed-out visitors of `/join/<token>` to `/login?next=/join/<token>`, and sign-in, sign-up and Google sign-in all return to it.
- `server/routes/auth/callback.get.ts` finishes Google sign-in and reset links by exchanging the PKCE code for a session cookie, then redirects to the `next` path (same-origin only; default `/`).

Supabase project settings this app expects:

- **Confirm email must stay off** (Authentication → Sign In / Providers → Email). Sign-up then returns a session and the user lands on the home page straight away.
- **Google provider** must be configured before "Continue with Google" works; see [docs/google-sign-in-setup.md](docs/google-sign-in-setup.md).
- **Password reset** needs `/auth/callback**` redirect URLs, the bilingual reset email template and, for production, Mailgun as custom SMTP; see [docs/password-reset-setup.md](docs/password-reset-setup.md).

## Profile

- `profiles` has one row per auth user, created by the `on_auth_user_created` trigger (`supabase/migrations/20261021000000_create_profiles.sql`). The display name comes from Google's `full_name`/`name`, else the part of the email before `@`. `locale` starts empty and is set to the language the user first browses in.
- RLS: a user reads and updates only their own row (`display_name`, `locale`, `theme` columns only); members of the same household can read it through `shares_household()`. Inserts happen only through the trigger, deletes through the `auth.users` cascade.
- `app/plugins/profile.ts` loads the profile during SSR and whenever the signed-in user changes, then applies its theme and language over the cookies. `useProfile()` reads and saves the row; `useProfileSettings()` applies a change at once and puts the old value back if saving fails.
- `/me` edits the display name, language and theme, and holds sign-out.

## Households

- `households` and `household_members` (one row per member). `household_members.user_id` is unique, so a user belongs to one household. `household_members.role` is `owner` or `member`; a partial unique index allows one owner per household. Households that existed before B3 (`supabase/migrations/20261026000000_add_household_member_management.sql`) got their earliest member as owner.
- `create_household(household_name)` (`supabase/migrations/20261021000100_add_household_creation.sql`, owner added in the B3 migration) is the only way to create a household; the creator becomes its owner. It trims and checks the name (1–50 characters), writes the household and your member row in one transaction, and raises `already_in_household`, `invalid_household_name` or `not_authenticated`. The tables have no insert policies, so direct inserts are denied.
- `useHousehold()` loads your household and its members in one query (member names come through the `household_members.user_id` to `profiles.id` foreign key) and creates one through the function. `app/plugins/household.ts` forgets the loaded household when the signed-in user changes.
- `/household` shows the create form or the household overview. The Home page has a household card and `/me` a Household row.
- Invites (`supabase/migrations/20261023000000_add_household_invites.sql`): any member can create a link for their household (`create_household_invite()`), which works once and for 7 days, and revoke it (`revoke_household_invite()`). There is one live link per household: creating a new one revokes the old one. Only the SHA-256 hash of the 192-bit token is stored, so the URL is shown only right after it is created; the invite card on `/household` shows status, expiry and Revoke afterwards. `household_invites` has no write policies and its `token_hash` column is not readable.
- `/join/<token>` previews a link with `get_household_invite()` (valid, expired, revoked, used or not found) and joins with `accept_household_invite(token, leave_current)`. A user who is already in another household chooses between staying and leaving it for the new one; leaving removes them from the old household, which is deleted if they were its last member. The whole switch is one transaction, and concurrent use of one link is serialised by a row lock, so the second user sees "already used".
- Member management (B3, same migration as the role): `remove_household_member(user)` (owner only; also revokes the invite links that person created), `leave_household()`, `transfer_household_ownership(user)` and `delete_household()` (owner only). All lock the household row first, so they take turns, and raise `not_owner`, `owner_must_transfer`, `member_not_found`, `cannot_remove_self`, `invalid_new_owner` or `not_in_household`. An owner with other members cannot leave, and cannot switch households through an invite: they transfer ownership or delete the household first. The last member leaving deletes the household. `/household` shows a menu on each other member's row for the owner, a Leave button and, for an owner with company, Delete household.
- `AppNavigation` (mounted in `app/layouts/default.vue`) is the bottom bar on phones and a side rail from 960 px. Plan, List and Recipes are disabled until their pages exist: give their entry in `NAV_ITEMS` a `to` when they do.

## Database tests

pgTAP tests live in `supabase/tests/`. With the Supabase CLI and a local stack (`supabase start`), run:

```bash
supabase test db
```

## Translations

UI text comes from `i18n/locales/en.json` and `i18n/locales/lt.json` through `@nuxtjs/i18n` (`no_prefix` strategy). The locale follows the browser language, falls back to English, and is remembered in a `locale` cookie. Once signed in, the language saved on the profile wins. Every key must exist in both files.
