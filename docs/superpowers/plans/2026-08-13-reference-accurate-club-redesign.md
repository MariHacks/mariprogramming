# Reference-Accurate Club Redesign Implementation Plan

**Source of truth:** `../specs/2026-08-13-reference-accurate-club-design.md`

**Outcome:** Reproduce the supplied 1024×1536 editorial reference across the public Programming Club site, using the verified Fall 2026 form and a locally stored MariHacks photograph, while publishing truthful Coming Soon states for Book Delivery and Mini-Competitions.

## Work unit 1: restore a green baseline

Files: existing motion components/tests, `vite.config.js`, `package.json`, lockfile.

1. Run the three known failing Vitest files and `npm run check`; retain the failures as evidence.
2. Implement only the specified reduced-motion-safe transitions for cart count, checkout feedback, and paid confirmation. Fix the two test typing errors.
3. Add `@vitest/coverage-v8` compatible with the installed Vitest and configure authored-source coverage thresholds at 100% without counting generated/config/vendor files.
4. Remove Svelte compatibility warnings without changing product behavior.
5. Verify focused tests, full unit suite, check, lint, Prettier, build, and `git diff --check`.

## Work unit 2: source and process the hero asset

Files: `static/images/marihacks/*`, asset manifest/documentation.

1. Use `IMG_3519.jpg` from the supplied MariHacks folder `1XI7VhePrlujhrDi3tVEGRVTf6wfTsKR0`. Drive reports an original resolution of 4,612×3,459 and 16.9 MB.
2. Download it locally and produce 1600×1200, 960×720, and 640×480 WebP/AVIF derivatives. The role is the right-hand 4:3 hero crop, keeping both students and their laptops visible. Alt text: `Two MariHacks organizers working side by side on laptops.`
3. Record the local filenames, source folder/file, dimensions, crop role, and alt text in the asset manifest.
4. Test that public markup references only local assets and that no Drive URL or temporary path enters source/build output.

## Work unit 3: editorial shell and navigation

Files: `SiteHeader.svelte`, `SiteFooter.svelte`, shell tests, `src/styles.css`, club content.

1. Write failing tests for the Fall 2026 signup URL, icon-only accessible Instagram/Discord links, active-route state, and three responsive navigation modes.
2. Self-host the approved Inter, Inter Tight, and Roboto Mono font files; remove the Google Fonts import. Implement the 72px white header, exact brand lockup, navy/blue tokens, primary Sign up action, and navy footer.
3. At 1024px and wider, show full navigation. From 700px through 1023px, show a keyboard-complete `More` disclosure. Below 700px, show a mobile disclosure. Implement Escape, outside click, focus return, `aria-expanded`, `aria-controls`, and route-change close.
4. Humanize every visible string and scan for em/en dashes and middle-dot separators.
5. Verify unit, keyboard, forced-colors, reduced-motion, and overflow behavior.

## Work unit 4: reference-accurate homepage

Files: `src/routes/+page.svelte`, homepage tests, styles.

1. Add structural tests for the exact section order and truthful destinations.
2. Implement the split hero and three-line headline, activity band, workshop archive/Book Delivery split, Programming Hub band, and footer without decorative card grids.
3. Use the exact 1024 calibration contract from the spec: 72px header; section anchors at y=613, 861, 1286, 1457; 46px to 49px inset; 47.4% copy target; 58px to 60px headline.
4. Book Delivery teaser links to `/books` as a status page. Mini-Competitions displays Coming Soon and no false live challenge action.
5. Humanizer review, then unit and semantic heading/link tests.

## Work unit 5: public content routes

Files: About, Events, Workshops, Resources route components/tests and shared editorial primitives.

1. Add failing route tests for meaningful content, correct destinations, and removal of filler/repeated supertitles.
2. Apply the same ruled editorial system, strong typography, restrained blue accents, and open layouts to every route.
3. Preserve useful existing factual strings; remove copy that does not help a visitor decide or act.
4. Ensure sparse states are intentional editorial compositions rather than empty cards.
5. Verify semantic structure, 44px interactive targets, keyboard access, and no page overflow at 320/390/768/1024/1440.

## Work unit 6: truthful Coming Soon surfaces

Files: `/books` launch page, Mini-Competitions surface/links, tests.

1. Add failing tests that production `/books` contains no catalogue, cart, prices, teachers, checkout affordance, or placeholder covers.
2. Implement a concise Book Delivery Coming Soon page describing the service without promising an unlaunched date.
3. Ensure Mini-Competitions uses the same truthful state and no inactive control masquerades as an action.
4. Leave the full live Book Delivery UI accessible only in explicitly live test/staging mode, with the server gate owned by the backend plan.

## Work unit 7: restrained motion and accessibility

Files: motion contract tests, affected components/styles, accessibility tests.

1. Keep only motion that communicates state: navigation disclosure, checkout feedback, cart count, paid confirmation. Use durations from 120ms to 220ms and no ornamental stagger.
2. Provide complete `prefers-reduced-motion` fallbacks.
3. Test focus order, disclosure semantics, landmarks, headings, names, contrast, forced colors, zoom, and error announcements.

## Work unit 8: objective visual calibration

1. Install/use Playwright Chromium or the installed Chrome channel and capture 320, 390, 768, 1024×1536, and 1440 screenshots.
2. Compare 1024 output against the supplied reference. Measure header, section anchors, inset, split ratio, headline geometry, activity/archive/hub boundaries, and footer height using the spec tolerances.
3. Retain the final 1024×1536 reference, implementation, side-by-side, and difference/overlay captures in `tmp/visual-review/final/`. Iterate until measurements pass and visual review shows no beige, toy-like styling, excessive cards, clipped text, overlap, or horizontal scrolling.
4. Run a fresh Impeccable design reviewer and fix every material finding.

## Work unit 9: production-content and bundle gate

1. Build production with `BOOK_DELIVERY_LAUNCH_STATE=coming-soon`.
2. Scan source client imports and `.svelte-kit/output` for test fixtures, sample catalogue identifiers, `Cover placeholder`, generic `placeholder`, supplied Drive folder ID/URL, temporary paths, client-exposed env names, and secret prefixes.
3. Fail the build check on any match; allow only explicitly documented framework text outside app bundles.
4. Run Humanizer over every user-visible string and assert no em/en dash or middle-dot separators.

## Work unit 10: acceptance

Run full unit/coverage/check/lint/format/build/E2E suites. Give a fresh user subagent only these unbriefed goals: find the Fall 2026 signup form, find upcoming workshops, locate programming resources, join Discord, learn what MariHacks is, and determine Book Delivery availability. Repeat on desktop and 390px mobile, record confusion/dead ends, and fix them. Do not declare the public redesign complete until the visual measurements, retained artifacts, artifact scan, and fresh-user review pass.

## Combined execution order and ownership

Execution is sequential in the existing dirty worktree; no two implementers edit production files concurrently. Each unit gets one implementer followed by a fresh reviewer. Public WU1 owns shared test and coverage dependencies. Secure WU1 may add only backend runtime dependencies. The order is: Public WU1, Secure WU1, Secure WU4 configuration and schema generation, Secure WU2, Secure WU4 integration, Secure WU3 repository layer, Secure WU5, Public WU2 through WU8, Secure WU10 rate-bucket and logging foundation, Secure WU6 through WU9, Secure WU10 header and final integration, Secure WU3 staff catalogue UI, Secure WU11A, Secure WU11 through WU12, then Public WU9 through WU10. `/books` launch UI is owned by Public WU6; the server guard and nested API enforcement are owned by Secure WU5. Secure WU11 owns the single production artifact scanner, and Public WU9 adds its public-design forbidden patterns to that scanner instead of creating a second implementation.

Before editing, every unit records `git status --short` and the existing diff for each file it will touch. It integrates those edits incrementally and records its attributable post-edit delta. Ambiguous overlap stops that unit for a read-only audit or moves it to an isolated worktree. Agents never overwrite, normalize, or revert edits they did not author.
