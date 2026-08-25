# Goal: Build MariTools on the Programming Club site

You are implementing **MariTools**, a real product for Marianopolis students, as a Programming Club initiative. Not a demo. Work until the suite is qualified on the real app.

Repo: `/Users/sony0627/Programming/mariprogramming`
Remote: `https://github.com/MariHacks/mariprogramming`
Live: `https://mariprogramming.vercel.app`

Start on current `main` (must include Book Delivery / Svelte 5 club site, commit `a5ead16` or later). Fast-forward if behind. Do not use the old Bootstrap tree. Do not rewrite the stack.

---

## Mandatory skills (read the actual files, do not infer)

1. `/poteto-mode` at `~/.grok/plugins/pstack/skills/poteto-mode/SKILL.md` plus `references/grok-harness.md`. On Grok Build, spawn with `spawn_subagent`. Models from `~/.grok/rules/pstack-models.md`.
2. `principle-prove-it-works` (`~/.grok/plugins/pstack/skills/principle-prove-it-works/SKILL.md`). Real browser, real `.ics`, real DB, real NIM call counts. Agent summaries are not proof.
3. `karpathy-guidelines` before code. Surgical diffs. No speculative architecture.
4. **Design: `/impeccable`**. Read `~/.agents/skills/impeccable/SKILL.md`.
   - Run `node ~/.agents/skills/impeccable/scripts/context.mjs --target <path>` from the repo before UI work.
   - MariTools is **Operate** mode (`reference/operate.md`).
   - This is an **established world**. Inherit `DESIGN.md` and `src/styles.css`. Do **not** run `concept-seed` or invent a new visual identity. Do **not** rewrite DESIGN.md unless a token already used in code is missing from the doc.
   - Load `reference/craft-floor.md` immediately before editing UI.
   - After each milestone, run polish / harden / adapt on the new routes. Desktop and iPhone-width.
5. **Copy: `/humanizer`**. Read `~/.codex/skills/humanizer/SKILL.md`. **Every user-visible string** (headings, buttons, empty states, errors, tutorial, import notes, NIM disclosure, term banners) goes through humanizer in **embedded mode** before it ships. Voice: student-to-student, short, factual, club-site tone from `PRODUCT.md`. No marketing, no "unlock your potential", no AI-powered branding.
6. `/unslop` on prose you write (`~/.grok/plugins/pstack/skills/unslop/SKILL.md`).

---

## Product

**Name:** MariTools (easy to rename later; one config string).
**Line:** Tools for Marianopolis students. Built by students. Free.
**Owner:** Programming Club initiative. Google / Better Auth already under MariHacks.

One suite, three sections. Do not add more top-level sections.

```text
SCHEDULE
  My Schedule
  Common Free Time

COURSES
  Semester
  Course Catalog
  (books are fields on a course page, not a marketplace)

STUDENT LIFE
  Clubs
  Forum
```

AI is infrastructure for outline extraction. It is not the product identity. No chatbots, streaks, feeds, gamification, or giant onboarding.

Housing: `/tools` on this site. Club homepage stays recruitment. `/books` stays Book Delivery commerce. Never take that route.

---

## Locked decisions (do not reopen)

- **Books marketplace:** cancelled. Course pages may show title / author / ISBN / required? from outlines or catalog contributions. No listings, prices, sold, DMs.
- **Auth:** Google, existing MariHacks OAuth client. Any Google account. Do not require `@office.marianopolis.edu` or `@marianopolis.edu`.
- **Student ID:** collected when completing an account. Store server-side only. Never show on forum, catalog, schedule, or HTML. Never use it to log into Omnivox or scrape Léa.
- **Staff:** `team@marihacks.com` is staff. Any account may be promoted from the backend (staff UI or DB). Opening student Google must not admit random users to Book Delivery `/staff`.
- **Teacher-student day:** classes **do** meet (e.g. 2026-10-05 still generates Monday meetings).
- **NVIDIA:** follow the recommendation below. Key arrives later on the Desktop.

---

## NVIDIA NIM (v0.2)

Do this:

1. Extract PDF **text locally**. Hosted chat does **not** accept PDFs.
2. `POST https://integrate.api.nvidia.com/v1/chat/completions` with schema in the prompt. Validate JSON locally. Fail closed. Never invent dates, weights, books, teachers, sections.
3. Config: `NVIDIA_NIM_API_KEY`, `NVIDIA_NIM_MODEL` (default `nvidia/nemotron-3.5-lightning-30b-a3b`, reasoning **off**). Fallback `nvidia/nemotron-3-super-120b-a12b`. Do not hardcode the model. Do not use deprecated `nemoretriever-parse`.
4. Cache by SHA-256 of the file and by offering (`term + course + section + teacher`). 100 students in one section must not cause 100 calls. Instrument hit/miss and inference count. Never log keys or full documents.
5. Minimal boundary: `OutlineExtractionProvider.extract(...)`. One NVIDIA implementation.
6. Before the first call, disclose: outline text is sent to NVIDIA for analysis; NVIDIA trial ToS may use User Content to improve models; contributing to the catalog is a separate opt-in; the raw PDF is not published.
7. Scanned PDFs: refuse with a clear "upload a text PDF" error. No OCR on the v0.2 hot path.
8. If NIM is down, invalid, or the key is missing: keep the upload, allow manual edit, bounded retry. Do not fabricate.

### API key file

The operator will create **`/Users/sony0627/Desktop/key`** (maybe `key.txt`) and paste the NVIDIA NIM API key. It may appear **after you start**, likely before NIM testing.

- Poll that path when you reach v0.2 extraction tests. Also accept `$NVIDIA_NIM_API_KEY` if already set.
- Read, trim whitespace, put in local env / `.env.local`. **Never commit. Never print. Never put in client bundles.** Add `key` to gitignore if you copy it into the repo tree (prefer env only).
- v0.1 does **not** need the key. Do not block My Schedule on it.
- If the file is still missing when you need a live NIM call, wait and retry. Manual entry and cache tests can run without it. Do not skip the cold-call proof if the key exists.

---

## Stack (do not fight it)

SvelteKit 2, Svelte 5 with `componentApi: 4`, Vite 7, JS + JSDoc, Node 22, `@sveltejs/adapter-vercel`.
Neon + Drizzle + Better Auth already exist for Book Delivery / staff.
Tests: Vitest (100% on authored `src/**/*.js`), Playwright e2e, `npm run check`, `npm run lint`, `npm run verify:production` artifact scanner.
CSP: `connect-src 'self'`. NIM and Google stay server-side.
Public chrome: `SiteHeader` / `SiteFooter`. Staff routes hide that chrome. Do not hide it on `/tools`.
Visual tokens already in `src/styles.css`: `--midnight #061431`, `--club-blue #0b4cf4`, `--paper #f8fafc`, `--graphite`, `--quiet-steel`, `--mist`, Inter Tight / Inter / Roboto Mono (codes only). Flat, ruled, editorial. Electric blue is scarce. No beige, no purple SaaS, no card grids as page structure.

---

## Global academic term

One system for every term-dependent tool.

```text
AcademicTerm    id, name, startDate, endDate, classStartDate, classEndDate, status
AcademicCalendarRules    termId, noClassDates[], scheduleOverrides[{ date, followsWeekday }]
```

Do not overload `startDate`/`endDate`. If today is in no configured term, **safe expired state**: "Current-term data is unavailable." Never silently reuse last semester. Historical terms remain browsable on purpose. Term picker lives once in tools chrome.

v0.1 stores this as committed JSON. Same shape moves to Postgres at v0.2.

### Fall 2026 (official PDF, published 27 Feb 2026)

Source: https://www.marianopolis.edu/wp-content/uploads/2026/03/academic_calendar_2026-2027.pdf

- Classes begin **2026-08-18**. Classes end **2026-12-04**.
- No-class: 2026-09-07 (Labour Day), 2026-10-12 (Thanksgiving), 2026-11-09 (exam simulation). **Not** 2026-10-05.
- Overrides (follows Monday): 2026-09-08, 2026-10-09, 2026-10-14, 2026-11-12.
- In-class finals still generate meetings. Common/ministerial exam days do not.
- Generate explicit occurrences. No semester-length `RRULE`.

Winter 2027: class start **2027-01-18**. Study week 2027-03-01–05 no-class. 2027-03-23 Friday schedule. 2027-03-26 and 2027-03-29 closed. 2027-04-12 exam simulation no-class. 2027-04-14 Monday. 2027-05-13 Wednesday schedule. Confirm May last-class-day against the PDF while coding. Do not invent a summer term from the 2027-06-02 cyan box.

---

## v0.1 My Schedule (build first, prove, then continue)

No account. No Omnivox credentials. No scraping.

Flow: `/tools` → Schedule → native tutorial if needed → paste → parse → review/edit → Mon–Fri timetable → term → occurrences → `.ics` plus Apple/Google/Outlook notes.

### Native tutorial (do not embed Scribe)

Recreate from these steps (Scribe captions are wrong on two buttons):

1. https://marianopolis.omnivox.ca/Login/Account/Login
2. Student number field
3. Log In
4. Left sidebar **Course Schedule**
5. Pick semester, **Obtain my schedule** (not "Submit")
6. Yellow printer banner **Click here for a printer-friendly version**
7. Radio **Compact printable semester schedule**
8. **View** (not "Submit")
9. Copy the **right-hand numbered list**, not the grid, not the name/student-number header

Crop tutorial screenshots so the captured legal name and student number never ship. Warn if paste looks like it contains a student number. Return to the paste box.

### Canonical fixture (permanent test)

Must yield **7 courses, 14 meetings**:

```text
1  	Badminton and Conditioning
PHE-103-A1 sec.00002, teacher: Alexandre Vachon-Gee
Mon 08:15 - 10:05, classroom GYM
 
2  	Algèbre linéaire et géométrie vectorielle
201-SN4-RE sec.00502, teacher: Jean-François Deslandes
Mon 10:15 - 12:05, classroom D-120B
Wed 10:15 - 12:05, classroom D-120B
 
3  	Object-Oriented Programming
420-SNT-MS sec.00001, teacher: Robert Vincent
Tue 08:15 - 10:05, classroom I-412
Fri 08:15 - 10:05, classroom D-318
 
4  	Shakespeare's Communities
603-103-MQ sec.00019, teacher: Blair Morris
Tue 14:15 - 16:05, classroom D-209
Thu 14:15 - 16:05, classroom D-209
 
5  	ENRICHED - MODERN PHYSICS - Waves and Modern Physics
203-SN3-RE sec.00021, teacher: Baharak Fatholahzadeh
Tue 16:15 - 17:35, classroom A-109
Thu 16:15 - 17:35, classroom A-109
Fri 10:15 - 12:05, classroom D-305
 
6  	Comparaison d'oeuvres littéraires
602-UF2-MQ sec.00020, teacher: Rémi Poitras
Wed 12:45 - 14:05, classroom D-407
Fri 12:45 - 14:05, classroom D-407
 
7  	Chimie des solutions
202-SN2-RE sec.00501, teacher: Lori Jinbachian
Wed 14:15 - 16:05, classroom G-308
Fri 14:15 - 16:05, classroom I-214
```

Parser is a pure function. Tolerate tabs/spaces, blank lines, CRLF, trailing space, accents, apostrophes, GYM, long titles. Do not overfit this one paste.

Timetable: times, rooms, identity, gaps, long days, overlaps. Desktop and ~390px.

ICS: title, classroom, code, section, teacher. Prove 2026-09-08 has Monday meetings and 2026-09-07 has none. Prove 2026-10-05 still has Monday meetings.

Stale clock 2027-01-05: current-term unavailable, historical Fall 2026 still selectable.

---

## v0.2 Semester + catalog + Google

Extraction is a **proposal** until the student reviews it. Provenance (page/evidence) when practical. Opt-in contribute **structured fields only**. Never publish the PDF or long copied passages. Conflicts: same offering + different hashes are revisions; same offering + different facts stay side by side, no last-write-wins.

Catalog browse is anonymous. Contribute requires Google + completed student ID.

Do not reuse Book Delivery `courses` / `books` / `orders`. Evergreen `Course` vs term `CourseOffering`.

Anonymous utilities keep working without login.

---

## v0.3 Common Free Time

Reuse v0.1 parser and term engine. Multiple people. Duration filters. Busy intervals only if sharing. Calendar-aware for specific dates.

---

## v0.4 Clubs + Forum

Clubs: contributed, staff publish. Do not scrape MSU/Hub. Do not invent rooms or schedules.

Forum: read anonymous, write with Google. Course tags are catalog `Course` ids. Report queue for staff. No karma, DMs, algorithmic feed, AI replies.

---

## Implementation order

```text
v0.1 My Schedule → prove
v0.2 Semester + Catalog + NIM + Google accounts → prove
v0.3 Common Free Time → prove
v0.4 Clubs + Forum → prove
full-suite adversarial qualification
```

Do not leave a broken milestone and stack more features on it.

A suggested v0.1 file split (pure modules first):

1. `src/lib/maritools/term/` JSON + resolver
2. `src/lib/maritools/schedule/parseOmnivox.js`
3. occurrence generator
4. `/tools` shell + header link (update `SiteHeader.test.js` and e2e nav; still no Book Delivery in public chrome)
5. native tutorial
6. review + timetable
7. ICS + full flow
8. qualify in a real browser

Parser / term / occurrences stay framework-free. Svelte only renders.

---

## Proof (every milestone)

- Deterministic tests for the claims in that version
- `npm test`, `npm run check`; route work also `npm run test:e2e` and `npm run build`
- Real browser: desktop and iPhone width; empty, loaded, error; long EN/FR titles; dense pages
- Do not trust another agent's screenshot. Drive the app yourself (Playwright and/or Grok preview MCP `t3-code__preview_*`)

NIM proof when the Desktop key exists:

```text
cold uncatalogued offering → NIM call
same document again → 0 calls
validated catalog offering reused → 0 calls
```

Full-suite claims include: stale terms fail safe, PDFs not public, no-account utilities work, staff moderation works, v0.1 still works after v0.4.

---

## Do not

- Collect Omnivox passwords
- Invent college SSO
- Log raw schedules/outlines into analytics
- Weaken `/staff` while adding student Google
- Force-push `main`
- Commit secrets or the Desktop `key` file
- Start "making progress" by scaffolding v0.4 while v0.1 is unproven

---

## Finish

Report what students can actually do, proof per milestone, NIM call counts (no secrets), genuine limitations, and what future maintainers must update (new `AcademicTerm`, calendar exceptions, NIM env, clubs, moderation, secrets). The site must fail visibly when term data has not been maintained.
