# Common Free Time

Compare multiple Omnivox pastes and find shared free blocks.

## Sub-features

- `freetime-multi` — at least two schedules.
- `freetime-duration` — 30 / 45 / 60 minute (or custom) minimum gap.
- `freetime-date` — calendar date uses term rules and overrides.
- `freetime-busy-share` — export busy intervals JSON without course titles.

## How to get to it (user POV)

- Tools → Common Free Time, or `/tools/free-time`.
- Paste two or more schedules, set duration, compare week or a specific date.
- Optional: download busy-interval JSON for sharing.

## Driving it with browser MCP

- Open `/tools/free-time`.
- Paste two copies of the canonical schedule (or distinct schedules).
- Set minimum gap to 45 minutes, run compare.
- Expect Tuesday gap between morning and afternoon blocks.
- Set date `2026-09-08` with Fall 2026 term selected — follows Monday schedule.
- Download busy JSON; payload `kind` is `maritools-busy` and omits course names.

Proof: screenshot of week view and date filter; busy JSON artifact.

## Gotchas

- Empty paste slots are skipped; need at least two non-empty valid pastes.
- Date mode requires term picker in tools chrome.
