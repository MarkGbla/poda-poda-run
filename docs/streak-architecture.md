# Daily streak architecture (design before implementation)

## Repository audit

Vite builds vanilla JS with Three.js 0.128. Main gameplay is src/main.js; startRun resets the run then transitions to play and emits game:start. endRun computes a RunRules summary and submits scores through ApiClient. GameStateMachine and GameClock govern movement. Existing Modal uses native dialog, focus restoration and browser Back. CSS is split by screen; dark panels, gold accents and rounded buttons are existing conventions. GuestProfile and the exception-safe store in main use localStorage.

Cloudflare Worker routes through server/worker.mjs. Google OAuth uses verified identities and HttpOnly application sessions; player IDs come from requirePlayer. D1 migrations live in server/db/migrations. Accounts.profile returns stats and versioned garage preferences. Runs.start validates ranked route/vehicle/version and records idempotent request IDs; Runs.finish validates summaries and atomically stores score/stat updates. Rankings exclude local Central/practice runs. Node test runner and a SQLite-backed D1 adapter exist, plus Playwright smoke scripts. Production configuration exists, but a real Google login and production database are not accessed by this task.

## Rules and data

Shared pure date/status functions use configurable Africa/Freetown (UTC+00). Normal gameplay start qualifies, no minimum score/time. First day=1; same day=no change; yesterday=+1; larger gap=1; longest never decreases. Expired status displays zero without erasing stored history. Future/corrupt guest values are rejected. Practice/demo automation does not qualify.

D1 player_streaks owns one row per player. Atomic UPSERT uses date comparison, retains longest, and only updates for a later date. A qualifying-event receipt table prevents the same UUID counting again after midnight. A transaction batches receipt, conditional update and authoritative read. Existing ranked run start invokes this operation; a companion run-activity route covers unranked Central and unnamed accounts, using the same authentication, origin checks, validation and rate limiting. Browser cannot supply counts, dates or player IDs. This proves authenticated participation requests, not human gameplay; existing architecture cannot cryptographically prove a run start.

Guest updates use the existing storage wrapper and Web Locks for cross-tab serialization. Without Web Locks, same-date writes still converge to the same count; simultaneous tabs may both queue a celebration. Storage failure falls back to memory. Account state stays out of guest storage. Server responses are guarded by account identity. Retry uses the same event ID and is restricted to the same account and day; no retrospective offline claims.

## Account reconciliation

Guest history is unsigned and cannot safely establish server history. Therefore no historical count is imported, including a larger guest longest. Guest progress remains preserved in its own device slot and returns after logout; account history wins on login. A guest run that began before login is not replayed into an account. The no-import policy is deterministic and idempotent and preserves all eligible *trusted* progress. No new Google identity/session implementation is introduced.

## UI / lifecycle

Qualify after actual main startRun setup. Never wait for network or pause moving gameplay. Queue a confirmed new day, show at results or home when safe, clear pending before opening. Refresh/load alone never creates a celebration. Continue/Escape/Back close the dialog without starting a run or submitting a score. Home indicator exposes current/longest/qualified status; responsive dialog fits landscape and safe areas, with reduced-motion support. No per-frame storage/network operations.

## Delivery

Apply migration 0003_streaks.sql through the existing Wrangler migration workflow before deploying the Worker. No production migration or deployment is performed here. STREAK_TIMEZONE can override the server default; changing it for an established population requires a planned history migration. Server responses include the timezone for frontend status calculations.
