# Phase 6. Review and timetable

Back: [overview](./overview.md)

## Goal

Paste, parse, edit obvious mistakes, and see a Monday–Friday timetable that makes gaps and overlaps obvious. Works on a laptop and a narrow phone.

## Changes

- My Schedule page: textarea, parse action, warning list, editable course fields, timetable.
- Long English and French titles must not blow the layout.
- Overlaps visible. Empty parse state is a short instruction, not a dashboard.

## Data structures

UI state: pasted text, `ParseResult`, draft courses (same shape as parser output). No server.

## Verification

**Static.** Component tests with the canonical fixture: 7 titles visible, 14 meetings placed. Overlap fixture shows a conflict. `npm test`.

**Runtime.** Paste the fixture in the real app. Desktop and iPhone width. Edit a room and see the timetable update. Try a garbage paste and see a recoverable error.
