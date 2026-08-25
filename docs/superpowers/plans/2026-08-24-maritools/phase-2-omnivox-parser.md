# Phase 2. Omnivox parser

Back: [overview](./overview.md)

## Goal

Turn the compact printable right-hand list into 7 courses and 14 weekly meetings for the canonical fixture. Tolerate messy whitespace. Do not scrape Omnivox.

## Changes

- Add `src/lib/maritools/schedule/parseOmnivox.js` as a pure function from pasted text to a result object.
- Fixture file with the exact 7-course dump from the product spec.
- Reject or warn when the paste looks like it contains a student number in a header line (`Zhi Cheng Ma - 2530622` style). Do not keep that identifier in parsed output.

## Data structures

```text
ParseResult
  ok
  courses[]
    title, courseCode, section, teacher
    meetings[]
      weekday, startTime, endTime, classroom
  warnings[]
```

Times as `HH:MM` 24-hour. Weekdays Mon–Fri. Classroom strings keep GYM and room codes as copied.

## Verification

**Static.** Canonical fixture → 7 courses, 14 meetings. CRLF, extra blanks, trailing spaces, French accents, apostrophes. Malformed input returns `ok: false` without throwing. Student-number header produces a warning and is not stored as a course. `npm test`.

**Runtime.** None beyond unit tests in this phase. Paste UI comes in phase 6.
