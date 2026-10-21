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

## Database tests

pgTAP tests live in `supabase/tests/`. With the Supabase CLI and a local stack (`supabase start`), run:

```bash
supabase test db
```

## Translations

UI text comes from `i18n/locales/en.json` and `i18n/locales/lt.json` through `@nuxtjs/i18n` (`no_prefix` strategy). The locale follows the browser language, falls back to English, and is remembered in a `locale` cookie. Once signed in, the language saved on the profile wins. Every key must exist in both files.
