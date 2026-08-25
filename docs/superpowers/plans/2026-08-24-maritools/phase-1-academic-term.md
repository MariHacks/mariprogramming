# Phase 1. Academic term JSON

Back: [overview](./overview.md)

## Goal

One term module every later tool can import. Fall 2026 is configured from the official calendar PDF. If today is outside every term, the resolver returns an unconfigured current term instead of the previous one.

## Changes

- Add `src/lib/maritools/term/` with term records, calendar rules, and `resolveCurrentTerm(today, terms)`.
- Commit Fall 2026 (and Winter 2027 if the same file stays small) as data, not `if (labourDay)` in code.
- Teacher-student day is **not** a no-class date.

## Data structures

- `AcademicTerm`: `id`, `name`, `startDate`, `endDate`, `classStartDate`, `classEndDate`, `status`
- `AcademicCalendarRules`: `termId`, `noClassDates[]`, `scheduleOverrides[]` as `{ date, followsWeekday }`
- `TermResolution`: `{ selected: AcademicTerm | null, reason: 'contains-today' | 'none' | 'explicit' }`

`startDate`/`endDate` are the term window. `classStartDate`/`classEndDate` are meeting generation bounds. Do not overload one pair.

Fall 2026 class bounds: 2026-08-18 through 2026-12-04.

No-class (Fall): 2026-09-07, 2026-10-12, 2026-11-09 (exam simulation). Not 2026-10-05.

Overrides (Fall): 2026-09-08 Monday, 2026-10-09 Monday, 2026-10-14 Monday, 2026-11-12 Monday.

Winter 2027 can land in this phase if it fits one file. Study week 2027-03-01–05 is no-class. 2027-03-23 Friday schedule. 2027-03-26 and 2027-03-29 closed. 2027-04-12 exam simulation no-class. 2027-04-14 Monday schedule. 2027-05-13 Wednesday schedule.

## Verification

**Static.** Tests for contains-today, after-endDate returns none, explicit pick of a historical term, teacher-student day still in session. `npm test`, `npm run check`.

**Runtime.** A small node/vitest clock: 2026-08-24 → Fall 2026. 2027-01-05 → none.
