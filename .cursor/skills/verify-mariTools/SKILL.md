---
name: verify-mariTools
description: Drive MariTools on the Programming Club site — schedule paste, common free time, semester upload, catalog, clubs, forum, and Google account completion. Use before claiming a MariTools milestone is shippable.
---

# Verify MariTools

MariTools lives at `/tools` on the SvelteKit club site. Proof is browser-first: real paste flows, real Postgres when `DATABASE_URL` is set, and Playwright for regression.

## Launch

From repo root:

```bash
npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Ready when `http://127.0.0.1:4173/tools` returns 200.

For DB-backed tools (account, semester, catalog, clubs, forum), set `DATABASE_URL` to a disposable Postgres URL before preview. Apply `drizzle/0008_maritools_persistence.sql` (and runtime grants) with the migrator role first — `scripts/apply-maritools-migration.mjs` or `GET /api/cron/maritools-migrate` when `MIGRATION_DATABASE_URL` is set. Runtime bootstrap only seeds terms.

Teardown: stop the preview process you started (Ctrl+C or kill the PID from `lsof -i :4173`). Do not `pkill node`.

## Doctor

1. `curl -sf http://127.0.0.1:4173/tools/schedule | head -c 200` — body mentions schedule or Omnivox.
2. `npx vitest run src/lib/maritools` — parser, term, and free-time unit tests pass.
3. If `DATABASE_URL` is set: `npx vitest run src/lib/server/maritools/repository.integration.test.js` — Postgres persistence smoke passes.

If doctor fails, fix before driving UI.

## Drive

Primary harness: Playwright (`tests/e2e/maritools-schedule.spec.js`) and `cursor-ide-browser` MCP for exploratory proof.

Stable selectors:

- Schedule paste: `textarea` on `/tools/schedule`, button "Parse schedule" or equivalent primary action.
- Free time: `/tools/free-time`, at least two textareas, button "Find shared free time".
- Catalog: `/tools/catalog` — anonymous browse, filter by term.
- Account: `/tools/account` — Google sign-in boundary (manual OAuth in browser proof).
- Semester: `/tools/semester` — requires signed-in session with completed profile + NIM disclosure.
- Clubs: `/tools/clubs` — published list; submission form when signed in.
- Forum: `/tools/forum` — thread list anonymous; `/tools/forum/[id]` for replies.

Use `browser_snapshot` before clicks. Desktop (~1280px) and iPhone width (~390px) for layout checks on schedule and free-time.

NIM live proof (when `NVIDIA_NIM_API_KEY` or Desktop `~/Desktop/key` exists):

1. Upload a text PDF on semester — cold call increments inference count.
2. Re-upload same file — 0 new NIM calls (cache hit).
3. Contribute validated offering to catalog — reuse path shows 0 calls.

## Evidence

Store proof under `.artifacts/verify-mariTools/<feature>/` (gitignored). Capture:

- Screenshot after the user-visible success state.
- For schedule: downloaded `.ics` file or occurrence list for a known date (e.g. 2026-09-08 has Monday meetings; 2026-09-07 none).
- For free time: screenshot showing shared gap with duration filter applied.
- For catalog: HTML snapshot showing published entry without student numbers.
- Terminal transcript or log line for NIM call counts when exercising semester.

Proof standards: exercise the public route a student uses; confirm side effects (DB rows, ICS bytes) not only button labels.

## Cleanup

Stop preview. Leave `.artifacts/verify-mariTools/` intact. Do not delete evidence when tearing down the server.

## Helpers

```bash
npm run test:e2e -- tests/e2e/maritools-schedule.spec.js
npx vitest run src/lib/maritools/schedule
```

Feature map: `features/README.md` in this skill directory.
