# Daily streak delivery

Read [research](research/danfo-streak/streak-research.md) and [architecture](streak-architecture.md) for verified Danfo findings and deliberate Poda deviations.

## Shipped behavior

A normal run starts a daily streak, regardless of route, vehicle, score or public driver-name setup. Demo/benchmark/showcase runs are excluded. One Freetown calendar day counts once; consecutive days increase, missed days reset to one, longest is retained. Expired current counts display zero. Celebration is deferred until results/Home, never stops moving traffic, and Continue/Escape/Back use the existing native-dialog helper. A home chip allows inspection. Refresh does not replay celebrations.

Guests use the existing exception-safe local store with cross-tab Web Locks; storage failure preserves current-session progress in memory. Authenticated counts come exclusively from the server and are never copied to guest storage. Server qualification is transactional, protected by session/origin checks and input validation, and idempotent across days. Ranked starts reuse their existing request IDs; the companion activity endpoint covers Central and unnamed accounts. Streak outages do not invalidate ranked-run sessions.

Guest history has no trustworthy signed evidence. It is preserved locally but not imported into account totals. This intentionally declines unverified historical import rather than taking the largest count or overwriting established account history. Logout restores the separate guest history. The account-present marker stores only a boolean so offline previously authenticated devices do not fabricate account progress.

## Changed files (this task only)

| Files | Purpose |
|---|---|
| src/services/StreakRules.mjs | Shared timezone, normalization, qualification and status rules; conservative reconciliation |
| src/services/GuestStreak.mjs | Guest persistence, Web Locks, in-memory fallback |
| src/ui/StreakUI.js; streak-ui.css | Responsive accessible celebration, home indicator, confirmed-response queue, safe retries, midnight status timer |
| src/main.js | Small setup/start/end/Home/profile hooks; existing unrelated edits preserved |
| src/services/ApiClient.js | Persist non-sensitive account-presence flag for offline handling |
| server/db/migrations/0003_streaks.sql | Owned streak rows and replay receipts with constraints |
| server/services/Streaks.mjs | Atomic server qualification and validated activity endpoint |
| server/services/Runs.mjs | Reuse ranked-run start event; preserve score session during streak outage |
| server/services/Accounts.mjs; server/worker.mjs | Profile status/timezone and authenticated activity routing |
| tests/streak.test.cjs; tests/helpers/account-db.cjs | Pure/guest/SQLite/Worker tests and migration loading |
| tests/helpers/account-preview.cjs | Configurable local fixture port for isolated browser runs |
| scripts/streak-smoke.mjs; scripts/streak-account-smoke.mjs | Reproducible gameplay/UI and actual Worker two-browser checks |
| scripts/smoke.mjs | Dismiss expected streak after Home; wait for DOM and game controls instead of all media loading; allow slow scene setup in clicks |
| docs/streak-*.md; docs/research/danfo-streak/ | Design, research, execution results and real screenshots |

This commit includes the streak files and the small hooks listed above. Existing lighting and traffic changes are already on the fork’s main branch.

## Deployment

No production deployment or database mutation was performed. Apply migration before deploying the updated Worker:

```sh
npx wrangler d1 migrations apply DB --remote
npm run deploy
```

Those commands are instructions for an authorized release, not actions taken. Existing Cloudflare configuration is preserved. Optional Worker variable STREAK_TIMEZONE defaults to Africa/Freetown; guest profile responses publish that setting too. Offline guests fall back to the built-in Freetown default. Changing an established timezone needs a history migration plan.

## Limits

- No live Google consent/login or production D1 exercise: account browser tests use the existing local session fixture and actual Worker backed by SQLite.
- Guest clocks/history are editable; unsigned historical streaks are not imported. Web Locks serialize supported browsers; fallback writes converge on daily totals but simultaneous unsupported tabs may both celebrate.
- Pending account retries are in memory, same-account and same-date only. Closing the page can lose an unconfirmed attempt. Refresh restores any already committed server progress without replaying a celebration.
- A browser cannot prove human play. Authenticated start requests are validated but are not anti-cheat attestation.
- Devices synchronize on profile refresh, reconnect and gameplay requests; no live polling/push.
- Dialog screenshots are Chromium viewport tests, not physical Android/iPhone Safari device tests.
- A dedicated flame illustration, weekly attendance row, shields and cosmetic rewards were intentionally omitted; no Danfo artwork/source was reused.
