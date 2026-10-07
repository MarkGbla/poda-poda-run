# Online leaderboard setup

The game and local results work without D1. The checked-in `wrangler.jsonc` deploys the game and Worker with static assets; API routes report that the leaderboard is unavailable until a D1 database is configured.

For Cloudflare Workers Builds, use the repository root, `npx wrangler deploy` as the deploy command, and the default dependency installation. The `postinstall` script builds `dist` even when the dashboard Build command is empty. You can also set the dashboard Build command to `npm run build` for an explicit build step. Do not disable npm lifecycle scripts when leaving that command empty.

1. Sign in to the Cloudflare account and create a D1 database named `poda-poda-run`.
2. Add the `d1_databases` entry from `wrangler.example.jsonc` to the checked-in `wrangler.jsonc`, replacing the placeholder database ID. Add the rate-limit binding only if desired; choose a `namespace_id` unique within the account.
3. Build the client with `npm run build`.
4. Apply `server/db/migrations/0001_initial.sql` to the local database and run the Worker locally. Exercise one complete run, a repeated finish request, and all leaderboard periods.
5. Apply the migration to the production database, then deploy the Worker and its static assets. Verify the custom domain separately before directing players to it.

The API stores an anonymous browser UUID, optional display name, aggregate run results, and timestamps. It does not collect a real name, email address, or location. `/api/runs/start` creates a one-use session token; `/api/runs/finish` accepts one summary for that session. The Worker checks ranges and recalculates the score from the submitted totals. Aggregate checks cannot prove that the browser played a genuine run; a stronger competitive leaderboard would require a compact event trace or server-driven simulation.

Invalid or unavailable online submissions leave the player's result and best score in browser storage. The UI reports that the online leaderboard is unavailable. The current implementation does not queue offline submissions.

Current API routes:

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/runs/start` | Start an anonymous versioned run |
| POST | `/api/runs/finish` | Submit one aggregate summary and receive score and rank |
| GET | `/api/leaderboard?period=today\|week\|all` | Read the top 50 runs |
| GET | `/api/player/:id/best` | Read a player's best run |

Run summaries use game version `0.1.0`. Changing scoring or route rules requires a version bump and corresponding server validation update.
