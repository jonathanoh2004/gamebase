# Setting up Gamebase on Supabase and Vercel

Everything here fits the free tiers. Budget about an hour the first time. You'll need accounts on GitHub, Supabase and Vercel. Discord, Google, Cloudflare and Resend accounts are only for the optional sign-in methods.

Dashboard labels move around. If a menu named here has a slightly different name in your dashboard, look for the closest match.

## 0. Make the repository private

Rulebooks and photos are copyrighted, so `games/*/source/` is gitignored while the repository is public. On GitHub, go to **Settings → General → Danger Zone → Change visibility → Private**. After that you can delete the `games/*/source/` line from `.gitignore` if you want the sources versioned.

## 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com). Pick the region closest to your friends and save the database password somewhere safe.
2. Open **Connect** (top of the project page). You'll use two connection strings from it:
   - **Session pooler** (port 5432), user `postgres.<project-ref>`. This is the *owner* connection, used only from your machine to run migrations.
   - **Transaction pooler** (port 6543). The app uses this, but with its own role instead of `postgres` (step 3).

## 2. Run the migrations

On your machine, from the repository:

```sh
pnpm install
MIGRATION_DATABASE_URL='postgres://postgres.<project-ref>:<db-password>@<session-pooler-host>:5432/postgres' \
  pnpm db:migrate
```

This creates the private `app` schema, the `gamebase_app` role, row-level security and the Realtime channel policies. Run it again after pulling new migrations; it only applies what's new.

## 3. Give the app its own database login

The app never connects as `postgres`. In the Supabase **SQL Editor**, run this with a long random password (`openssl rand -hex 24`):

```sql
alter role gamebase_app with login password '<app-password>';
```

The app's `DATABASE_URL` is the **transaction pooler** string with that role in place of `postgres`:

```
postgres://gamebase_app.<project-ref>:<app-password>@<transaction-pooler-host>:6543/postgres
```

The pooler finds your project from the `.<project-ref>` suffix on the user name. If it rejects the login, compare the host and port with the transaction-pooler string under **Connect**, then check that the `alter role` ran.

## 4. Lock down the parts Gamebase doesn't use

- **Data API:** go to **Project Settings → Data API** and turn it off. Gamebase talks to Postgres directly and never uses the REST/GraphQL API. Its tables live in the `app` schema, which is never exposed, and they're protected by row-level security either way.
- **Realtime:** go to **Project Settings → Realtime settings** and turn off **Allow public access**, so only private channels exist. Each room is a private channel, and a database policy lets in only that room's players (and spectators, if the room allows them).

## 5. Auth: URLs and API keys

1. Go to **Authentication → URL Configuration**:
   - **Site URL:** your production address, e.g. `https://gamebase.vercel.app`.
   - **Redirect URLs:** add `https://gamebase.vercel.app/auth/callback`. For local development against Supabase, also add `http://localhost:3000/auth/callback`. Leave preview deployments out unless you need sign-in there; if you do, add your preview pattern, e.g. `https://*-<your-team>.vercel.app/auth/callback`.
2. Go to **Project Settings → API Keys**. Create the new keys if the page offers to, then copy:
   - the **publishable** key (`sb_publishable_…`): safe in the browser.
   - a **secret** key (`sb_secret_…`): server only. Gamebase uses it just to ban revoked members and delete accounts.

## 6. Sign-in methods

Gamebase offers Discord, Google and email magic links. Enable any subset, and list the ones you enabled in `SIGNIN_METHODS` (step 7) so the sign-in page shows only those.

All OAuth providers use the same callback in their own consoles: `https://<project-ref>.supabase.co/auth/v1/callback`.

### Discord

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**.
2. Under **OAuth2**, add the redirect above and copy the **Client ID** and **Client Secret**.
3. In Supabase, go to **Authentication → Sign In / Providers → Discord**, enable it and paste both values.

### Google

1. In the [Google Cloud Console](https://console.cloud.google.com), open **APIs & Services**. Configure the **OAuth consent screen**: External, with the scopes `openid`, `email` and `profile`.
2. Go to **Credentials → Create credentials → OAuth client ID → Web application**:
   - **Authorized JavaScript origins:** your site URL.
   - **Authorized redirect URIs:** the Supabase callback above.
3. In Supabase, go to **Authentication → Sign In / Providers → Google**, enable it and paste the client ID and secret.

While the consent screen is in "Testing", only test users you add can sign in. Publish it, or add your friends as test users.

### Email magic links (with Resend)

Supabase's built-in mailer is heavily rate-limited, so it's only fit for testing. For real use:

1. Create a [Resend](https://resend.com) account and verify a domain you own. Without a domain, Resend only delivers to your own address.
2. Create an API key.
3. In Supabase, go to **Authentication → Emails → SMTP Settings** and enable custom SMTP:
   - host `smtp.resend.com`, port `465`, user `resend`, password = the API key
   - sender = an address on your verified domain.
4. Under **Authentication → Emails → Templates**, edit **Magic Link** and **Confirm signup** so their link is:

   ```html
   <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Sign in to Gamebase</a>
   ```

   Gamebase always asks for a redirect that already has a `?next=…` query, so the `&` is right. This kind of link works on any device: a friend can ask for the email on a laptop and tap it on a phone. The default template only works in the browser that asked for it.

### Turnstile (bot protection for the email form, optional)

1. In the Cloudflare dashboard, go to **Turnstile → Add widget**. Add your domain (and `localhost` for development), then copy the **site key** and **secret key**.
2. In Supabase, go to **Authentication → Attack Protection** (or **Bot and Abuse Protection**). Enable CAPTCHA, choose Turnstile and paste the **secret** key.
3. Put the **site key** in `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (step 7).

Once CAPTCHA is on in Supabase, every email sign-in must carry a token. Set the site key before you turn it on, or email sign-in stops working.

## 7. Deploy on Vercel

1. In Vercel, go to **Add New → Project** and import the GitHub repository. The defaults are right: Next.js, `pnpm build`, Node 22.
2. Under **Settings → Environment Variables**, add these for **Production** (and **Preview** if you want previews to work):

   | Name | Value |
   | --- | --- |
   | `GAMEBASE_BACKEND` | `supabase` |
   | `DATABASE_URL` | the `gamebase_app` transaction-pooler URL (step 3). Mark it **Sensitive**. |
   | `NEXT_PUBLIC_SITE_URL` | `https://gamebase.vercel.app` (your address) |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |
   | `SUPABASE_SECRET_KEY` | `sb_secret_…`. Mark it **Sensitive**. |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | the Turnstile site key, if you use it |
   | `SIGNIN_METHODS` | the methods you enabled, e.g. `discord,email` (default: all three) |
   | `CRON_SECRET` | `openssl rand -hex 32`. Mark it **Sensitive**. |

   Never set `MIGRATION_DATABASE_URL` or `DEV_AUTH_SECRET` on Vercel. The app refuses the local backend on production deployments.
3. Deploy. `vercel.json` schedules a daily maintenance job: it clears old rate-limit rows, closes stale lobbies, and should keep a free Supabase project from pausing for inactivity. If it pauses anyway, restore it from the Supabase dashboard.
4. Leave **Deployment Protection** on for previews (Vercel's default), so only you can open preview builds.

## 8. Become the owner

1. Open the site, sign in, and pick a display name. You'll land on "waiting for an invite": every new account starts as *pending*.
2. On your machine, run:

   ```sh
   MIGRATION_DATABASE_URL='postgres://postgres.<project-ref>:<db-password>@<session-pooler-host>:5432/postgres' \
     pnpm make-owner you@example.com
   ```

3. Refresh. You're the owner: **Admin** appears in the header. From there you create one-time invite links (48 hours, single use) and can revoke members.

Friends join by opening an invite link, signing in, and accepting. After that, any member can create rooms and share room links with other members.

## Rotating secrets

- **Database:** `alter role gamebase_app with password '<new>';` then update `DATABASE_URL` in Vercel and redeploy.
- **Supabase secret key:** create a new secret key, swap it in Vercel, redeploy, then delete the old key.
- **CRON_SECRET:** change it in Vercel and redeploy.

## Local development against Supabase

Copy `.env.example` to `.env.local`, fill it in as for Vercel (with `NEXT_PUBLIC_SITE_URL=http://localhost:3000`), and run `pnpm dev`. For everything else, `pnpm dev:local` needs no accounts at all.
