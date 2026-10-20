# Google sign-in setup

"Continue with Google" uses Supabase's built-in Google provider. The app code needs no extra environment variables: the Google client ID and secret live in Supabase. Setup takes about 30 minutes and is free.

Repeat step 2 for each Supabase instance (local, staging, production). One Google OAuth client can serve all of them.

These steps were written without access to the live docs. Check menu names against [Supabase: Login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google).

## 1. Google Cloud Console

1. Open [console.cloud.google.com](https://console.cloud.google.com) and create or pick a project (e.g. "meal-planner").
2. **Google Auth Platform → Branding**: app name "Meal Planner", user support email, developer contact email. Under **Authorized domains** add the app's domain and the Supabase domain (`<project-ref>.supabase.co`, or the self-hosted Supabase domain).
3. **Audience**: user type **External**. While the status is **Testing**, only listed test users (up to 100) can sign in. Click **Publish app** to open sign-in to everyone.
4. **Data access**: keep the default non-sensitive scopes `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`. They need no Google review. Adding a logo triggers brand verification, so skip it at first.
5. **Clients → Create client → Web application**:
   - Authorized JavaScript origins: `http://localhost:3000`, `https://<staging-domain>`, `https://<production-domain>`.
   - Authorized redirect URIs: the Supabase callback, `https://<project-ref>.supabase.co/auth/v1/callback` (self-hosted: `https://<supabase-domain>/auth/v1/callback`; Supabase CLI locally: `http://127.0.0.1:54321/auth/v1/callback`).
6. Copy the **Client ID** and **Client secret**. Keep the secret in a password manager; never commit it.

## 2. Supabase

### Supabase cloud (dashboard)

1. **Authentication → Sign In / Providers → Google**: enable it, paste the Client ID and Client secret, save.
2. **Authentication → URL Configuration**:
   - Site URL: the production app URL.
   - Redirect URLs: `http://localhost:3000/auth/callback**`, `https://<staging-domain>/auth/callback**`, `https://<production-domain>/auth/callback**` (the `**` lets password reset links pass a `next` query; see [password-reset-setup.md](password-reset-setup.md)).

### Self-hosted on Coolify

Set these on the Supabase auth service, then restart the auth container:

| Variable | Value |
| --- | --- |
| `GOTRUE_EXTERNAL_GOOGLE_ENABLED` | `true` |
| `GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID` | Client ID from step 1 |
| `GOTRUE_EXTERNAL_GOOGLE_SECRET` | Client secret from step 1 |
| `GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI` | `https://<supabase-domain>/auth/v1/callback` |
| `GOTRUE_SITE_URL` | production app URL |
| `GOTRUE_URI_ALLOW_LIST` | comma-separated `.../auth/callback` URLs as above |

### Supabase CLI locally (optional)

In `supabase/config.toml`:

```toml
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
```

and add `http://localhost:3000/auth/callback` to `additional_redirect_urls` under `[auth]`.

## 3. Check

1. Open `/login`, click **Continue with Google** and pick a test user. You land on `/`.
2. In Supabase **Authentication → Users** the user shows provider `google`.

Google's consent screen says "continue to `<project-ref>.supabase.co`" until Supabase is served from a custom domain (a paid add-on on Supabase cloud; free when self-hosted on your own domain).

If something fails, the app returns to `/login?error=oauth` and shows "Signing in with Google did not work".
