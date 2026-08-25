# Phase 4. Tools shell and term chrome

Back: [overview](./overview.md)

## Goal

MariTools has a home under `/tools` with global term context. Club recruitment stays the site homepage. Book Delivery stays off public nav.

## Changes

- Routes: `/tools`, `/tools/schedule` (stub is fine if later phases fill the body).
- Add a MariTools link to `SiteHeader` primary/compact/mobile lists. Update `SiteHeader.test.js` and `tests/e2e/club-navigation.spec.js`.
- Tools chrome states it is a Programming Club initiative. Term control once in the tools layout, not on every club page.
- Copy: “MariTools. Tools for Marianopolis students. Built by students. Free.”

Do not hide SiteHeader on `/tools` the way `/staff` does. Staff isolation stays staff-only.

## Data structures

Client store or layout data: `{ resolution: TermResolution, setExplicitTerm(id) }`. Default from `resolveCurrentTerm(today)`.

## Verification

**Static.** Header tests include MariTools and still exclude Book Delivery. Layout test still suppresses chrome only on `/staff`. `npm test`, e2e club navigation.

**Runtime.** Open `/` and `/tools` in the browser. Desktop and ~390px width. Term control visible on tools, not plastered on About.
