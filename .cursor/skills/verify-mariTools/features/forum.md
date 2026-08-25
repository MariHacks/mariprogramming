# Forum

Read threads anonymously; post and reply with Google account.

## Sub-features

- `forum-read` — thread list and detail without author ids in HTML.
- `forum-write` — new thread and replies.
- `forum-report` — report queue for staff.
- `forum-moderate` — lock, remove thread/reply.

## How to get to it (user POV)

- `/tools/forum` and `/tools/forum/[threadId]`.

## Driving it with browser MCP

- Guest: read thread list and bodies.
- Signed in with completed profile: create thread, reply.
- Report flow on thread/reply.
- Staff: lock thread, remove content.

Proof: HTML lacks `authorUserId`; DB rows in `mt_forum_threads`; screenshot + `npx vitest run src/routes/tools/forum/`.

## Gotchas

- Categories: `courses` or `student-life` only.
- Locked threads reject new replies.
