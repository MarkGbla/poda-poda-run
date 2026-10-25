# Executed validation — 24–25 October 2026

The isolated release checkout, based on fork `origin/main` at `318366e`, passed its production build and **all 88 tests** in one run on Node 22. See [release-suite.txt](release-suite.txt). The counts below document the earlier development working tree, which also contained local lighting and traffic work.

- Production Vite build: passed. Existing large-bundle warning remains.
- Initial `npm test` after backend integration: all 88 existing tests passed in 96 seconds.
- Full Node suite with 60-second per-file limit: 81 passed; CBD file timed out (no failed assertions).
- CBD file rerun alone with 120-second limit: all 14 passed in 94 seconds.
- Final focused streak / Worker / API-client run after outage handling was added: 17 passed (8 streak, 6 Worker, 3 API client).
- These earlier runs covered 96 tests in the development working tree, with the slow CBD file executed separately. The isolated release checkout has 88 tests and passed them in one run.
- `git diff --check`: passed.
- Guest Playwright gameplay checks: 11 scenarios passed, no page errors. See [browser-results.json](poda/browser-results.json).
- Account Playwright checks: 5 scenarios passed, no page errors, using actual Worker routes and the SQLite-backed local fixture. See [account-browser-results.json](poda/account-browser-results.json). Includes failed start/activity requests, reconnect retry, two browser sessions, guest/account separation and logout.
- Responsive screenshots: 1280×800 desktop, 360×640 portrait, 667×375 landscape, and a five-day fixture qualified through actual gameplay. No UI was fabricated or force-shown for screenshots.
- Broad existing gameplay smoke: initial attempt reached final motorcycle navigation but timed out on full `load`. The DOM-ready rerun completed: 50 checks passed, one Central start click timed out at eight seconds, zero page errors; subsequent checks showed that Central vehicle advancing. See gameplay-smoke.txt. The isolated Central rerun with a 30-second click limit passed all 26 checks with zero page errors; see central-smoke.txt. All broad scenarios have passing evidence across these runs, but this is not presented as a fully green single broad run.

## Reproduction

```sh
npm run build
node --test --test-timeout=120000 tests/*.test.cjs
npm run dev -- --host 127.0.0.1 --port 5181
node scripts/streak-smoke.mjs
node scripts/smoke.mjs --url=http://127.0.0.1:5181/
```

Account browser fixture (separate terminal, fresh process for each test since logout revokes its token):

```sh
PORT=5191 node tests/helpers/account-preview.cjs
STREAK_ACCOUNT_URL=http://127.0.0.1:5191 node scripts/streak-account-smoke.mjs
```

Scripts use installed Chromium 1228 on this machine; set SMOKE_CHROMIUM to another executable path where necessary. Guest smoke accepts STREAK_URL. Do not point the fixture tests at production. Actual Google consent and production D1 were not exercised. No physical iOS/Android device verification is claimed.

Final review on 25 October 2026: the previously pending Central smoke result was collected and passed. No additional production changes or deployment were made during this review.
