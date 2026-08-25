# Phase 8. v0.1 qualification

Back: [overview](./overview.md)

## Goal

Prove My Schedule on the real site before any v0.2 work. Fix anything that is wrong or hard to use.

## Changes

Only fixes found while proving. No catalog, auth, or forum.

## Claims to prove

1. Canonical paste → 7 courses, 14 meetings.
2. 8 Sep 2026 follows Monday.
3. 7 Sep and 12 Oct have no classes.
4. 5 Oct (teacher-student) still has Monday classes.
5. After `classEndDate`, current term is not implied. Clock 2027-01-05 shows current-term unavailable. Picking Fall 2026 still works.
6. `.ics` is valid.
7. Tutorial is native and returns to paste.
8. Desktop and ~390px layouts are usable: long titles, dense days, empty and error states.
9. No student number is stored or shown from the sample Omnivox header.
10. Club homepage, staff chrome, and Book Delivery launch gate still behave as on `main`.

## Verification

**Static.** `npm test`, `npm run check`, `npm run lint`, `npm run test:e2e`, `npm run build`.

**Runtime.** Full browser path: home → MariTools → Schedule → tutorial → paste fixture → edit → timetable → term → download. Repeat at phone width. Stale-term path with a forced date or a temporary test term that does not contain today.
