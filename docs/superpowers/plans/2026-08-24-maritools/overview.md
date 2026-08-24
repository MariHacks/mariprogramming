# MariTools implementation plan

Base: `main` at `a5ead16` (live Programming Club site plus gated Book Delivery).
Do not implement until the user says to start.

## Context

MariTools is a free student utility suite. Working name stays MariTools. It is a Programming Club initiative. Identity and OAuth live under MariHacks (existing `GOOGLE_CLIENT_ID`, staff mailbox `team@marihacks.com`).

A student should open a tool and know what it does. No chatbot product, no streaks, no feed.

## Scope

**v0.1 in this plan (build first, prove, stop).**

- `/tools` suite shell on this site
- My Schedule: native Omnivox tutorial, paste, parse, review, Mon–Fri timetable, term-aware occurrence list, `.ics` export
- One global academic-term system as committed JSON
- No account
- No Omnivox credentials or scraping

**Later milestones (spec only until v0.1 ships).**

- v0.2 Semester, Course Catalog, Google accounts, student ID at signup, books as course fields
- v0.3 Common Free Time
- v0.4 Clubs + Forum

**Explicitly out**

- Peer used-book marketplace, listings, prices, sold state, DMs
- Taking over `/books` (that route is Book Delivery commerce)
- Marianopolis SSO, `@office.marianopolis.edu` allowlists, Omnivox login
- Public display of student IDs
- Using student IDs to fetch schedules
- New cloud providers (stay on Vercel + Neon + Better Auth)
- Rewriting the club site or Book Delivery

## Locked product decisions

| Topic | Decision |
|---|---|
| Name | MariTools |
| Housing | `/tools` on this site. Club homepage stays recruitment |
| Books | Fields on a course offering (title, author, ISBN, required?). Not a marketplace |
| Auth | Google. Any Google account. No college-email bind |
| Student ID | Collected at account completion. Stored server-side. Never shown on forum, catalog, or schedule |
| Staff | `team@marihacks.com` is staff. Any account can be promoted from the backend |
| Teacher-student day | Regular class meetings **do** occur |
| Accounts org | MariHacks Google / Better Auth already on this app |

## Constraints

- SvelteKit 2, Svelte 5 with component API 4, Vite 7, JS + JSDoc, Node 22
- `DESIGN.md` visual system. No new palette, no CDN fonts/scripts
- Root `prerender = true`. Tools pages that are static+client may prerender. Anything that reads secrets sets `prerender = false`
- CSP: `connect-src 'self'`. NIM and Google token exchange stay server-side
- Public header tests and e2e currently enumerate club links. Adding MariTools updates those tests. Do not put Book Delivery in public chrome
- Staff routes stay Google-gated to staff role. Opening student Google must not weaken `/staff`
- Coverage gate on authored `src/**/*.js`. New modules get colocated tests
- Quality: `npm test`, `npm run check`, `npm run lint`, `npm run test:e2e`, `npm run build`
- Browser proof via the real app (Playwright + Grok preview MCP). Compiling is not proof

## Alternatives

1. **`/tools` on this app (chosen).** One deploy, one design system, Book Delivery untouched.
2. Separate subdomain. Extra Vercel project and auth origin for a club of 2000.
3. Replace the club homepage with MariTools. Breaks the site’s stated job (recruitment).

v0.1 data as committed JSON rather than Postgres. The same term/rule shapes move to Drizzle at v0.2 when shared catalog data exists.

## Applicable skills

- `/poteto-mode` throughout
- `how` before editing SiteHeader, auth, or Book Delivery boundaries
- `principle-model-the-domain`, `principle-foundational-thinking`, `principle-boundary-discipline`
- `principle-prove-it-works` on the real timetable, `.ics`, and stale-term banner
- `unslop` on user-visible copy
- `karpathy-guidelines` (small diffs, no speculative layers)

## Phases

v0.1:

1. [Academic term JSON](./phase-1-academic-term.md)
2. [Omnivox parser](./phase-2-omnivox-parser.md)
3. [Occurrence engine](./phase-3-occurrence-engine.md)
4. [Tools shell and term chrome](./phase-4-tools-shell.md)
5. [Native Omnivox tutorial](./phase-5-tutorial.md)
6. [Review and timetable](./phase-6-review-timetable.md)
7. [Export and full schedule flow](./phase-7-ics-and-flow.md)
8. [v0.1 qualification](./phase-8-qualification.md)

Later:

- [v0.2–v0.4](./later-milestones.md)

## Verification

Project-level after each v0.1 phase:

```sh
npm test
npm run check
```

After phases that touch routes or chrome, also:

```sh
npm run test:e2e
```

v0.1 done means a browser walk from `/tools` through tutorial, fixture paste, timetable, term, download, and a stale-clock banner. Unit tests alone are not enough.

## Implementation guidance

- Run `how` on SiteHeader, root layout, and staff chrome before changing them.
- Parser, term resolver, and occurrence generator are pure modules. Svelte only renders.
- Do not thread Book Delivery launch state into MariTools.
- `/unslop` before commit. Do not force-push `main`.
- Keep a short decision trail for term-rule encoding (show-me-your-work, local is enough).
- After a PR exists, babysit CI. Do not merge without an independent verdict.

Each v0.1 phase should be independently committable and leave tests green.
