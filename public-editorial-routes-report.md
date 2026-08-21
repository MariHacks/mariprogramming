# Public editorial routes report

## Scope

- Reworked About, Events, Workshops, and Resources inside the established Student Technical Journal system.
- Added the truthful Mini-Competitions status page at `/mini-competitions`.
- Connected Mini-Competitions from the homepage and from wide, compact, and mobile navigation.
- Kept Book Delivery behind its existing server-enforced Coming Soon boundary.
- Preserved the verified Fall 2026 signup form, Discord invite, Instagram profile, MariHacks site, workshop archive, and resource destinations.

## Editorial design

The routes now share the homepage's cool paper, ink navy, electric blue, Inter Tight, and Inter visual system. Their layouts use open columns and ruled indexes. They do not use beige surfaces, floating cards, decorative panels, or ornamental supertitles.

- About uses a two-column mission and participation index. It states beginner access, reports Mini-Competitions honestly, and links directly to sign-up, workshops, resources, and Discord.
- Events uses one confirmed-only schedule. The empty state is factual, and the page offers workshop, Instagram, and Discord destinations without inventing dates.
- Workshops retains every repository-backed workshop and material link, grouped by its real learning track.
- Resources keeps the existing verified destinations in four scannable ruled groups.
- Mini-Competitions contains one Coming Soon status, a short factual explanation, and two working alternatives. It has no fake challenge, date, registration, leaderboard, countdown, or inactive control.

Sparse About, Events, and Mini-Competitions pages now reserve enough height to place the navy footer at the viewport edge. This keeps their quiet space inside the composition rather than leaving an accidental blank strip below the footer.

## Copy review

Every revised string received the Humanizer draft, audit, and final pass in embedded mode. Repeated explanations and generic instructions were removed. The final route copy contains no em dash, en dash, middle dot, decorative eyebrow, stale date, fake metric, or unsupported launch claim.

## Motion review

The motion-opportunity gate rejected route entrances, list staggers, image drift, and animated empty states. These are reading and directory surfaces, so movement would slow scanning. No new route motion was added. The existing header disclosure remains the one necessary state transition.

## Automated verification

- Focused component and route tests: 43 of 43 passed.
- Full Vitest suite: 657 of 657 passed across 60 files.
- Authored JavaScript coverage: 100 percent statements, branches, functions, and lines.
- Installed Chrome editorial E2E: 7 of 7 passed.
- `npm run check`: zero errors and zero warnings.
- `npm run lint`: passed.
- Production Coming Soon build: passed.
- `git diff --check`: passed.
- Impeccable detector: no findings.
- Forbidden punctuation scan over all revised route and navigation sources: no findings.

## Chrome visual review

Installed Chrome captured every route at 320, 390, 700, 768, 900, 1023, 1024, and 1440 CSS pixels. The 40 final screenshots and their DOM measurements are retained in `tmp/visual-review/editorial/`.

All 40 route and viewport combinations have:

- zero horizontal overflow;
- exactly one level-one heading;
- no beige background match;
- visible links and buttons at least 44 by 44 CSS pixels.

The first 320 pixel Mini-Competitions capture exposed a heading overflow. The mobile display size and wrapping were bounded, then the route matrix was regenerated. The sparse Events and About pages were also rechecked after their viewport-height correction.

The independent review then found two further regressions. At 1024 and 1440 pixels, the heading split `Competitions` inside the word. At 768 pixels, the compact header's social links were only 40 pixels wide. A browser regression now measures the `Competitions` text range and requires it to occupy one line, while every target must satisfy both width and height. The heading now breaks only after `Mini-`, `Competitions` is kept intact, and compact social links are 44 by 44 pixels. The expanded 40-capture matrix covers the complete compact-navigation range and passes at 700, 768, 900, and 1023 pixels.

## Review readiness

The public editorial routes are ready for a fresh independent UX and visual review. No commit was created.
