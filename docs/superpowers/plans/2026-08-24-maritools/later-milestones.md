# Later milestones

Back: [overview](./overview.md)

Do not start these until v0.1 qualification passes.

## v0.2 Semester + Course Catalog + Google accounts

Students upload a course outline, review extracted assessments/books, and may contribute structured fields to a catalog. Books are a section on the course page (title, author, ISBN, required?). No marketplace.

**Auth.** Better Auth Google, same MariHacks OAuth client. Any Google account may sign in. Completing an account requires a student ID, stored server-side, never rendered on public pages, never sent to Omnivox. Staff if email is `team@marihacks.com` or `role` is staff/moderator. Promote anyone from the backend (staff UI or DB). `/staff` Book Delivery authorization stays a staff-role check, not “any signed-in user.”

**NIM.** Server-only. Config `NVIDIA_NIM_API_KEY`, `NVIDIA_NIM_MODEL`. Local PDF text → schema → validate → cache by SHA-256 and by offering. Disclose NVIDIA trial ToS before the first call. Flag can start off. Manual structured entry still works.

**Data.** New tables. Do not reuse Book Delivery `courses` / `books` / `orders`. `Course` evergreen vs `CourseOffering` term-scoped. Catalog identity is term + course + section + teacher + document hash. Conflicts stay visible.

Anonymous: catalog browse, schedule (still). Writes: sign in.

## v0.3 Common Free Time

Reuse v0.1 parser, term, occurrences. Multiple named schedules. Intersection of busy intervals. Duration filters. Optional share of busy intervals only.

## v0.4 Clubs + Forum

Clubs: contributed directory, staff publish. Do not scrape MSU or Hub. Do not invent rooms.

Forum: read anonymous, write with Google account. Course tags are catalog `Course` ids. Report queue for staff (`team@marihacks.com` and promoted accounts). No karma, DMs, or algorithmic feed.

## Full suite

Re-run v0.1 after v0.4 exists. Stale terms still fail safe. Student IDs still absent from public HTML.
