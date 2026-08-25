# Course catalog

Browse published structured course facts (assessments, books) without signing in.

## Sub-features

- `catalog-browse` — anonymous list.
- `catalog-filter` — term and course code query.

## How to get to it (user POV)

- `/tools/catalog` from Tools nav.
- Filter by term or course code.

## Driving it with browser MCP

Preconditions: `DATABASE_URL` with at least one published catalog contribution (seed via semester contribute flow or integration test seed).

- Open `/tools/catalog`. No sign-in prompt for browse.
- Filter `fall-2026`. Entries show code, section, teacher, structured fields.
- HTML must not contain student numbers.

Proof: screenshot of listing; `npx vitest run src/routes/tools/catalog/page.server.test.js`.

## Gotchas

- Empty catalog is valid before any student contributes.
- Books are fields on the page, not a marketplace.
