# Password reset setup

"Forgot password?" uses Supabase Auth's built-in recovery email. The app code needs no extra environment variables: email settings live in Supabase. Repeat the Supabase steps for each instance (local, staging, production).

These steps were written without access to the live docs. Check menu names against [Supabase: Password-based auth](https://supabase.com/docs/guides/auth/passwords), [Supabase: Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) and [Mailgun: SMTP](https://documentation.mailgun.com/docs/mailgun/user-manual/sending-messages/send-smtp).

## How the flow works

1. `/forgot-password` calls `resetPasswordForEmail` with `redirectTo: <origin>/auth/callback?next=/reset-password`. The browser client stores a PKCE code verifier in a cookie.
2. The email link goes to Supabase, which verifies it and redirects to `/auth/callback?code=…&next=/reset-password`.
3. `/auth/callback` exchanges the code for a recovery session (using the verifier cookie) and redirects to `/reset-password`.
4. `/reset-password` calls `updateUser({ password })` and sends the user home, signed in.

The link must be opened in the browser that requested it: the verifier cookie only exists there. Otherwise the exchange fails and the user lands on `/forgot-password?error=link` with an explanation.

## 1. Redirect URLs

The reset link carries a `next` query, so the allow-list entry needs a trailing `**` wildcard. Without it Supabase drops the redirect and sends the user to the Site URL.

### Supabase cloud (dashboard)

**Authentication → URL Configuration → Redirect URLs**: replace the `/auth/callback` entries with

- `http://localhost:3000/auth/callback**`
- `https://<staging-domain>/auth/callback**`
- `https://<production-domain>/auth/callback**`

### Self-hosted on Coolify

| Variable | Value |
| --- | --- |
| `GOTRUE_URI_ALLOW_LIST` | comma-separated `.../auth/callback**` URLs as above |

## 2. Email template (English and Lithuanian)

Supabase sends one recovery template per project, so it carries both languages. Keep `{{ .ConfirmationURL }}`: that is the link the flow above expects.

**Subject:** `Reset your password / Slaptažodžio atkūrimas`

**Body (HTML):**

```html
<h2>Reset your password</h2>
<p>Someone asked to reset the password for your Meal Planner account. Open this link in the same browser where you asked for it:</p>
<p><a href="{{ .ConfirmationURL }}">Set a new password</a></p>
<p>If you did not ask for this, ignore this email. Your password stays the same.</p>
<hr>
<h2>Slaptažodžio atkūrimas</h2>
<p>Kažkas paprašė atkurti jūsų Meal Planner paskyros slaptažodį. Atidarykite šią nuorodą toje pačioje naršyklėje, kurioje jos paprašėte:</p>
<p><a href="{{ .ConfirmationURL }}">Nustatyti naują slaptažodį</a></p>
<p>Jei to neprašėte, nekreipkite dėmesio į šį laišką. Jūsų slaptažodis nepasikeis.</p>
```

- **Supabase cloud:** **Authentication → Emails → Templates → Reset password**: paste the subject and body, save.
- **Self-hosted:** host the body as an HTML file the auth container can fetch and set `GOTRUE_MAILER_TEMPLATES_RECOVERY=<file URL>` and `GOTRUE_MAILER_SUBJECTS_RECOVERY=<subject>`, then restart the auth container.

## 3. Mailgun as the email server (production)

Supabase's built-in mailer is for testing only: it sends a handful of emails per hour (cloud) and may only deliver to team members' addresses. Use Mailgun as custom SMTP before real users rely on password reset.

### 3.1 Mailgun account and sending domain

1. Sign up at [mailgun.com](https://www.mailgun.com) (check the current free tier) and pick the **EU** region if users are in Lithuania. The region decides the SMTP host below and cannot be changed later for a domain.
2. **Sending → Domains → Add new domain**: use a subdomain such as `mg.<your-domain>`, so Mailgun's DNS records don't clash with the main domain's email.
3. Add the DNS records Mailgun shows at your DNS provider: the SPF `TXT` record, the DKIM `TXT` record and, if listed, the `MX` and tracking `CNAME` records. Click **Verify DNS settings**; it can take up to 48 hours, usually minutes.
4. **Sending → Domain settings → SMTP credentials**: create a login such as `auth@mg.<your-domain>` and copy the generated password into a password manager. Never commit it.

### 3.2 SMTP values

| Setting | Value |
| --- | --- |
| Host | `smtp.eu.mailgun.org` (EU region) or `smtp.mailgun.org` (US region) |
| Port | `587` (STARTTLS) |
| Username | the SMTP login from 3.1 step 4 |
| Password | its password |
| Sender email | e.g. `no-reply@mg.<your-domain>` |
| Sender name | `Meal Planner` |

### 3.3 Supabase cloud (dashboard)

1. **Authentication → Emails → SMTP Settings**: turn on **Enable custom SMTP**, enter the values from 3.2, save.
2. **Authentication → Rate Limits**: the email limit starts low after switching to custom SMTP; raise it to what you expect (e.g. 30 per hour).

### 3.4 Self-hosted on Coolify

Set these on the Supabase auth service, then restart the auth container:

| Variable | Value |
| --- | --- |
| `GOTRUE_SMTP_HOST` | host from 3.2 |
| `GOTRUE_SMTP_PORT` | `587` |
| `GOTRUE_SMTP_USER` | SMTP login |
| `GOTRUE_SMTP_PASS` | SMTP password (secret) |
| `GOTRUE_SMTP_ADMIN_EMAIL` | sender email |
| `GOTRUE_SMTP_SENDER_NAME` | `Meal Planner` |

## 4. Check it

1. On `/login`, type an email of an existing account and click **Forgot password?**; the email is prefilled. Click **Send reset link**.
2. Open the email in the same browser and click the link. You land on **Set a new password**.
3. Save a new password; you land on the home page. Sign out and sign in with the new password.
4. In Mailgun, **Sending → Logs** shows the message as delivered.
