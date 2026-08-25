# My Schedule

Paste a compact Omnivox semester list, review meetings, and download `.ics`.

## Sub-features

- `schedule-paste` — parse canonical fixture (7 courses, 14 meetings).
- `schedule-ics` — generate occurrences for Fall 2026 with calendar overrides.
- `schedule-stale-term` — expired clock shows safe unavailable state.

## How to get to it (user POV)

- Header → Tools → Schedule, or `/tools/schedule`.
- Paste the numbered Omnivox list into the textarea.
- Parse, review timetable, export calendar.

## Driving it with Playwright / browser MCP

Preconditions: preview on `http://127.0.0.1:4173`.

- Open `/tools/schedule`.
- Paste `tests/fixtures` or `CANONICAL_OMNIVOX_SCHEDULE` from `src/lib/maritools/schedule/fixture.js`.
- Click parse/generate. Expect seven courses in review UI.
- Download ICS. File contains `VEVENT` rows; 2026-09-08 Monday meetings present; 2026-09-07 absent.
- Screenshot desktop and 390px width.

Proof: `npm run test:e2e -- tests/e2e/maritools-schedule.spec.js` plus `.artifacts/verify-mariTools/my-schedule/`.

## Gotchas

- Paste must be the right-hand numbered list, not the grid.
- Teacher-student day 2026-10-05 still generates Monday meetings.
- No account required; do not collect Omnivox passwords.
