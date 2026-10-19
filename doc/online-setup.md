# Player accounts and global rankings

## Implementation status

The client and Worker implement Google sign-in, opaque cookie sessions, unique public driver names, cloud garage preferences, accepted-run statistics, and Today / This week / All time / Top earners leaderboards. Guest play and device scores remain available without a backend.

The checked-in production `wrangler.jsonc` has the `podapodarun` D1 binding, both remote migrations are applied, and the production Worker has a `GOOGLE_CLIENT_SECRET`. The live API offers Google sign-in; its callback still needs a real-account browser test.

## Local development

```sh
npm install
npm run build
npm run db:local
cp .env.example .env
ln -s .env .dev.vars
npm run dev:cloud
```

Use `http://localhost:8787`. `wrangler.local.jsonc` is strictly a local configuration; never deploy it. The migrations command applies both migrations to local D1. For actual Google login, create a Google OAuth Web application client, register `http://localhost:8787/api/auth/google/callback` as an authorized redirect URI, and fill `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the ignored `.env` file. The `.dev.vars` symlink lets Wrangler read that same file as Worker bindings. Use the localhost hostname consistently.

`npm run dev` serves the game only, without the Worker API. `node tests/helpers/account-preview.cjs` provides an optional local, in-memory browser fixture on port 5190: `/?fixture=driver` seeds a fake signed-in driver and `/?fixture=guest` clears its cookie. This test helper is never bundled into the app or Worker.

## Production configuration

For the exact production D1 binding now in `wrangler.jsonc`, follow [the step-by-step D1 connection guide](cloudflare-d1-connection.md). Remote migration and deployment require Wrangler access to the Cloudflare account that owns `podapodarun`.

1. Confirm that Cloudflare D1 database `podapodarun` has ID `08c30206-6529-46f8-8876-8ac2fc9a46a1`. The production `wrangler.jsonc` already binds it as `DB` and points migrations to `server/db/migrations`.
2. Confirm that `PUBLIC_ORIGIN` is the exact HTTPS game origin, with no trailing slash. `ACCOUNTS_ENABLED` is set to `true`. Optionally configure the example `RUN_RATE_LIMITER` binding with an account-unique namespace ID.
3. Create/configure the Google OAuth Web client and consent screen. Register the exact production callback: `https://YOUR_GAME_DOMAIN/api/auth/google/callback`. During Google's testing mode, add the intended test users. The app requests only `openid`.
4. The public Google client ID is already in `wrangler.jsonc`. Set the private secret using `npx wrangler secret put GOOGLE_CLIENT_SECRET`; never put its value in client code, tracked files, or public Vite variables.
5. Both numbered migrations are already recorded on the remote database. Run `npx wrangler d1 migrations list DB --remote` to verify that no pending migration remains. Legacy anonymous rows are excluded from account statistics and rankings.
6. Run `npm test`, `npm run build`, and `npx wrangler deploy --dry-run`. Deploy the reviewed Worker and assets together using `npm run deploy` when ready. For Workers Builds, explicitly set `npm run build` as the build command and `npx wrangler deploy` as the deploy command.
7. Verify Google login on the real origin, choose a name, complete an eligible run, reload, and check the account and all leaderboard views. Repeat on a second device. Verify logout and guest play. Automated OAuth tests mock Google's network; they do not replace this credential/domain check.

To disable accounts without breaking local play, set `ACCOUNTS_ENABLED=false` and redeploy. Preserve the database. Do not revert or delete account tables as a rollback.

## Data and trust model

Google's stable `sub` identifies the account. Google email, real name, avatar, access tokens, and ID tokens are not stored. Players choose a public ASCII name of 3–20 letters, digits or underscores. Names are case-insensitively unique, reject a basic reserved/profanity list, and can change once every seven days. The list is basic filtering, not a complete moderation system.

OAuth uses state, a browser-bound attempt cookie, nonce, PKCE, and verified Google signatures/issuer/audience/expiry. Application sessions are random 256-bit opaque tokens, stored only as SHA-256 hashes in D1, with a 30-day absolute expiry. HTTPS cookies use `__Host-`, Secure, HttpOnly and SameSite=Lax. No `SESSION_SECRET` is needed for this opaque-session design. Logout revokes the current browser session. Mutations require the configured same origin and a custom request header.

A server-issued run belongs to the authenticated player and pins route, vehicle and rules version. Finish recomputes the score and checks timing, speed, stop counts, passenger supply, fares and other bounds. Accepted result insertion, consumption, cumulative statistics and period bests are one database transaction. Identical retries return the same receipt; conflicting retries are rejected. Client-provided player IDs never establish ownership.

These are aggregate plausibility checks, **not proof of genuine gameplay**. Deterministic event replay or server simulation, abuse review tools and stronger operational rate limits remain future work for a high-stakes competition.

## Progress and ranking rules

- Ranked routes: Western, Eastern and Cross-city, with all five vehicles. Central remains local-only pending a validation contract for its mapped route. Demo, benchmark and practice runs do not enter global rankings.
- Current version: `accounts-1`, shared through `src/simulation/RunRules.js`. Update the version and server validation together when changing gameplay rules.
- Today and week use UTC; the week begins Monday. Each player appears once, with their best accepted score for that period. All time uses their best accepted score. Top earners sums accepted fares and perfect-stop bonuses; coins do not count as fares.
- Ties use the earliest timestamp at which the value was achieved, then player ID. The public response contains the top 50 and the signed-in player's own rank, including outside the top 50.
- Cloud preferences contain only an allowlist of garage/route selections, with optimistic revision checking. A conflict requires refresh before another save. Initial device preferences may be explicitly imported. Existing local scores, money and achievements are never imported as trusted cloud totals.
- Cloud goal counts are derived from accepted runs. Existing device goals remain separate. There is no spendable cloud wallet or purchases system.
- Eligible runs need a server start while online. Failed finishes are queued per account/run in localStorage (up to 50), retried after reconnect or profile refresh. Authentication failures retain the queue for that account. An unaccepted run expires two hours after start; already accepted receipts remain retryable. Clearing browser storage removes pending results. When storage is unavailable, only the immediate network attempt is possible.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/auth/google` | Begin Google login |
| GET | `/api/auth/google/callback` | Verify callback and create session |
| POST | `/api/auth/logout` | Revoke current session |
| GET | `/api/me` | Session, profile, stats and preferences |
| POST | `/api/me/name` | Choose/change public name |
| POST | `/api/me/progress` | Save preferences with revision |
| POST | `/api/runs/start` | Create an owned, versioned run |
| POST | `/api/runs/finish` | Accept a summary atomically or return its receipt |
| GET | `/api/leaderboard?period=today\|week\|all\|earners` | Top 50 and personal rank |

The former anonymous score endpoints are no longer used. Numbered files in `server/db/migrations` are the source of truth for the schema; `schema.sql` is the historical anonymous schema only.

## Verification

`npm test` covers score bounds, OAuth token/callback checks, session ownership and expiry, CSRF, name uniqueness/cooldown, preference revisions, idempotent/concurrent finish, transaction rollback, ranking and client retry isolation. Tests execute both migrations using SQLite. Wrangler local migrations and a Worker bundle dry-run provide additional runtime checks. Browser testing uses the local fixture, not production identities.
