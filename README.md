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
- Shared design tokens live in `app/assets/css/tokens.css` (spacing, radii, breakpoints) and `app/assets/css/theme.css` (light/dark color custom properties). The color values there are kept in sync with the `vuetify.vuetifyOptions.theme` block in `nuxt.config.ts` so Vuetify and CSS-Modules layout code always agree.
- Toggle the theme with `useAppTheme()` (`app/composables/useAppTheme.ts`); the choice persists in a `theme` cookie and is applied via an `data-theme` attribute on `<html>` set server-side, avoiding a flash of the wrong theme.

## Auth

Auth uses Supabase's `@supabase/ssr` cookie-based session pattern:

- `server/middleware/supabase.ts` creates a per-request Supabase server client, refreshes the session, and exposes it via `event.context.supabase` / `event.context.supabaseUser`.
- `app/plugins/supabase.client.ts` creates the browser client and keeps `useSupabaseUser()` in sync via `onAuthStateChange`.
- `app/middleware/auth.ts` is a named route middleware (see `app/pages/index.vue`) that redirects to `/login` when signed out.
