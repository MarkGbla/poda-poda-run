# Danfo streak research — 24 October 2026

Inspected the live HTML, privacy policy and publicly served `main-CQePwR3D.js` bundle. See evidence.json for hash and offsets. The findings below refer to that current bundle. No reference implementation or artwork is incorporated into product code.

| Feature | Danfo Run behavior | Evidence | Confidence |
|---|---|---|---|
| Streak trigger | End of a run lasting >5 seconds; no score threshold at that call site | Current bundle: run-end call guarded by runT | High (code, not live playthrough) |
| Daily increment | Once per date, UTC+1; repeated date returns unchanged | Date helper and streak finish method | High |
| Missed day | One missed day can be shielded once per seven days; otherwise resets on qualification; live getter hides expired count | Streak class | High |
| Guest persistence | Browser storage, key lagosrun.streak.v1; current, best, last date and recent days/shields | Streak class; privacy §3 | High |
| Account sync | Policy promises synced progress including streak; frontend sync runs at run end | Privacy §4; sync call | High for published policy; backend conflict correctness unknown |
| Celebration UI | Full-screen dark overlay, orange 84–120px number, flame, weekly row, Continue; entrance and number bump; shown before results only when grew | Live HTML/CSS and showOver/showStreak/closeStreak methods | High for code |
| Persistent indicator | Home chip, active/inactive flame and count; Gist also exposes status | HTML and streakChip | High |
| Rewards | Cosmetic sticker at 3, paint at 7 if not already owned; no coin award in streak method | Reward map and ownership check | High |
| Missions / leaderboard | Separate progression systems; streak gets profile for cosmetic ownership | Call graph around run end | Medium |

Sources: https://danforun.com/ , https://danforun.com/privacy.html , https://danforun.com/bundle/main-CQePwR3D.js .

The browser navigation timed out during this session. Live triggering, screenshots, physical-device behavior, cookie fallback under failure, and Google cross-device conflict handling were not observed. CSS inspection is not a screenshot. No fictional reference screenshots are supplied. The backend is not public and was not probed.

## Poda decisions / deviations

Keep the requested Poda rules: qualify normal run starts (no five-second threshold), Africa/Freetown rather than UTC+1, no shields or cosmetic rewards. Those are explicit product choices, not claims about Danfo. Adopt its post-run celebration timing, count hierarchy, flame, Continue and home indicator. Use original styling consistent with Poda and no copied assets. A weekly strip is omitted because Poda stores streak totals, not arbitrary daily attendance history.
