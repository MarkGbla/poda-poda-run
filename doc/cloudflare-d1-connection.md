# Connect Poda-Poda Run to Cloudflare D1

This guide records the production binding and verified remote schema on 19 October 2026. The Worker reads D1 through `env.DB`; there is no database password or URL in `.env`.

**Verified state:** Cloudflare account access is working. The remote `podapodarun` database matches ID `08c30206-6529-46f8-8876-8ac2fc9a46a1`. Both `0001_initial.sql` and `0002_accounts.sql` were recorded as applied at 2026-10-19 14:07:51 UTC. A subsequent remote `migrations list` reported no pending migrations. The seven account tables are present. The live `/api/me` reports `authAvailable: true`, all four leaderboard endpoints respond, and `wrangler secret list` confirms that `GOOGLE_CLIENT_SECRET` is configured. A complete Google login still needs a browser test with an authorized Google account.

## What was changed

1. Added `d1_databases` to the production `wrangler.jsonc` with binding `DB`, database name `podapodarun`, database ID `08c30206-6529-46f8-8876-8ac2fc9a46a1`, and migrations directory `server/db/migrations`.
2. Added `PUBLIC_ORIGIN=https://podapodarun.com` and `ACCOUNTS_ENABLED=true` as public Worker variables. This origin already appears in the game's canonical and share links. If the actual deployed game uses another hostname, change this variable to that exact HTTPS origin before deploying and register its matching Google callback.
3. Kept the local `wrangler.local.jsonc` separate. `npm run db:local` and `npm run dev:cloud` continue to use local D1 storage; they do not touch the remote database.
4. Left Google credentials in the ignored local `.env` for development. The public Google client ID is in production `vars`; `GOOGLE_CLIENT_SECRET` is declared as a required encrypted Worker secret. The supplied database ID is an identifier, not a secret.

## Finish the connection in your Cloudflare account

Run these commands from `/Users/markgbla/Downloads/poda-poda-run` in a terminal signed in to the Cloudflare account that owns this database.

### 1. Authenticate Wrangler

```sh
npx wrangler login
npx wrangler whoami
```

Complete Cloudflare's browser authorization yourself if Wrangler is not already signed in. If you use an API token instead, set `CLOUDFLARE_API_TOKEN` in your terminal environment using your preferred secret manager; do not add it to `.env.example`, `wrangler.jsonc`, or Git. Wrangler is currently authenticated on this computer; an initial sandboxed check could not reach Cloudflare, but the network-enabled check succeeded.

### 2. Confirm the database identity

```sh
npx wrangler d1 list
```

Find `podapodarun` and confirm that its ID is `08c30206-6529-46f8-8876-8ac2fc9a46a1`. If it is not listed, stop: Wrangler is signed in to a different Cloudflare account or the ID needs correction.

### 3. Inspect and apply the schema

```sh
npx wrangler d1 migrations list podapodarun --remote
npx wrangler d1 migrations apply podapodarun --remote
```

The repository contains `0001_initial.sql` for historical anonymous scores and `0002_accounts.sql` for Google accounts, sessions, preferences, accepted runs, statistics, and rankings. Wrangler applies only unapplied migrations and captures a backup when applying them. Review the names printed by `migrations list` before applying. Do not import the old anonymous `runs` table into account rankings.

Both migrations are already applied to this database. Re-running the commands is safe and currently reports no pending migrations.

Verify the tables without writing data:

```sh
npx wrangler d1 execute podapodarun --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('players','app_sessions','player_progress','account_run_sessions','accepted_runs','player_stats','period_bests') ORDER BY name;"
```

All seven account table names should appear.

### 4. Complete the Google and site configuration

In the Google OAuth Web application client, add `https://podapodarun.com/api/auth/google/callback` to **Authorized redirect URIs**. Add `http://localhost:8787/api/auth/google/callback` as well if you want local Google sign-in. The earlier local browser test reached Google but was blocked by `redirect_uri_mismatch` until that local URI is registered.

The public `GOOGLE_CLIENT_ID` is already in `wrangler.jsonc`. Store the production `GOOGLE_CLIENT_SECRET` as a Cloudflare Worker secret, using the `poda-poda-run` Worker in the dashboard under **Settings → Variables and Secrets**, or with Wrangler:

```sh
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

Each `secret put` can deploy a new Worker version immediately. Enter the values only into the prompt or Cloudflare dashboard. If the Worker does not exist yet, deploy the code first and then add the secrets. The `.env` file is local only.

The production Worker now has `GOOGLE_CLIENT_SECRET` configured. Rotate the previously pasted client secret if you have not already done so. `secrets.required` causes future deployments to fail clearly while that secret is missing. Keep nonsecret production values in `wrangler.jsonc`; copy any dashboard variable changes there before deploying again. Do not place the secret value in that file or Git.

### 5. Build, deploy, and verify

```sh
npm test
npm run build
npx wrangler deploy --dry-run
npm run deploy
```

The production deploy must use `wrangler.jsonc`. Do not deploy `wrangler.local.jsonc`, which contains a local dummy D1 ID. After deployment, open the exact `PUBLIC_ORIGIN` address and check:

1. Driver profile offers **Continue with Google**.
2. A first Google login creates a player; choose a public driver name.
3. A second login with the same Google account returns to that player.
4. Finish an eligible Western, Eastern, or Cross-city run. Confirm the profile statistics and global leaderboard update, including after a reload.
5. Sign out and confirm guest play still works. Central runs stay local only.

If `/api/me` reports cloud accounts unavailable, check the deployed `DB` binding and `ACCOUNTS_ENABLED`. If the sign-in button is missing, check the Google Worker secrets and `PUBLIC_ORIGIN`. A Google `redirect_uri_mismatch` means the exact callback URL for that origin is not registered in Google Cloud Console.

Cloudflare references: [D1 bindings](https://developers.cloudflare.com/workers/wrangler/configuration/#d1-databases), [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/), [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/).
