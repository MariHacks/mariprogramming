# Phase 3. Occurrence engine

Back: [overview](./overview.md)

## Goal

Expand weekly meetings into explicit class dates using term rules. Prefer a list of occurrences over a clever `RRULE`.

## Changes

- Add `generateOccurrences(term, rules, courses, options)` in `src/lib/maritools/schedule/`.
- Walk each meeting weekday from `classStartDate` to `classEndDate`.
- Skip `noClassDates`.
- On `scheduleOverrides`, treat that calendar date as `followsWeekday` instead of the civil weekday.
- Teacher-student day generates meetings (phase 1 data).

## Data structures

```text
ClassOccurrence
  courseCode, title, section, teacher, classroom
  date, startTime, endTime
```

## Verification

**Static.** Frozen Fall 2026 + fixture:

- 2026-09-07 no meetings
- 2026-09-08 has Monday meetings (Badminton, Linear Algebra), not Tuesday ones
- 2026-10-05 has Monday meetings
- 2026-10-12 none
- 2026-10-09 has Monday meetings
- 2026-12-04 last generated date for ordinary meetings
- 2026-12-08 no ordinary meetings

`npm test`.

**Runtime.** Dump occurrence dates for one course in a test log fixture a reviewer can re-run. No UI yet.
