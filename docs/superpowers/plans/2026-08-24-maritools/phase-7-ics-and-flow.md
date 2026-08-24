# Phase 7. Export and full schedule flow

Back: [overview](./overview.md)

## Goal

A student goes from tutorial or paste to a downloadable `.ics` with real Fall 2026 dates in about a minute. No OAuth.

## Changes

- Confirm the global term (or show the unconfigured banner if none contains today).
- Build occurrences from the draft + selected term.
- Download `.ics` with title, classroom, course code, section, teacher.
- Short import notes for Apple Calendar, Google Calendar, Outlook.

## Data structures

ICS event fields map 1:1 from `ClassOccurrence`. UID stable per course+date+start.

## Verification

**Static.** Generated ICS from the fixture contains `DTSTART` on 2026-09-08 for Monday courses and does not contain 2026-09-07. `npm test`.

**Runtime.** Download the file. Open it (or `python`/`icalendar` parse). Confirm a Monday-on-Tuesday date. Follow the on-page import notes. No account wall.
