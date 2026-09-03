# Clubs

Browse published clubs; submit updates for staff review.

## Sub-features

- `clubs-browse` — published pages only.
- `clubs-submit` — signed-in submission queue.
- `clubs-staff` — publish and moderate pending submissions.

## How to get to it (user POV)

- `/tools/clubs`.

## Driving it with browser MCP

- Guest: see published clubs or empty state.
- Signed in: short intake (role + name), then editable listing at `/tools/clubs/submissions/[id]`.
- Staff (`team@marihacks.com`): pending queue links into the same submission page; Publish there.

Proof: Postgres `mt_clubs` / `mt_club_submissions`; screenshot of published list.

## Gotchas

- Staff verifies rooms and schedules; do not invent MSU data.
- Submissions are not auto-published.
