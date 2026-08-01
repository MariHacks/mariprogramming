# Marianopolis Club Redesign Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stale static club experience with a responsive, accessible Marianopolis Programming Club site that establishes the shared visual system for Book Delivery.

**Architecture:** Keep SvelteKit and the Vercel adapter, but replace the Bootstrap-led presentation layer with focused Svelte components and a small CSS token system. Move static club copy out of the legacy all-in-one `src/lib/content.js` into a dedicated club-content module so content can be updated without layout edits. Book Delivery routes are introduced only as a discoverable navigation destination in this plan; its cart and commerce UI arrive in the later plans.

**Tech Stack:** SvelteKit, Svelte 4, Vite, Vitest, Testing Library for Svelte, plain CSS custom properties, existing SVG assets.

## Global Constraints

- Preserve the established Midnight `#050D2E`, Club blue `#0D2173`, and Sky `#99C2FF` palette; add Paper `#F7F4ED`, Graphite `#181B25`, and Coral `#DF5B48` only for the approved roles.
- Do not show cart controls outside `/books` routes.
- Do not retain Fall 2024 placeholders, disabled sign-up copy, or outdated roadmap copy.
- Use plain, specific interface copy. Do not use middle-dot characters in UI copy or metadata.
- Meet keyboard, visible-focus, mobile, and reduced-motion requirements.
- Touch only files required for the redesign. Preserve existing public routes or redirect legacy routes deliberately.

## Component Ownership Protocol

The redesign is intentionally executed as one implementation and one independent review per visible component. Shared CSS, page composition, and route wiring are separate non-component work units. This keeps the visual language coherent without asking one agent to make unreviewed UX decisions for multiple components. The foundation component units are: `SectionIntro`, `ContentCard`, `SiteHeader`, `SiteFooter`, and `EventList`; each receives a component-specific brief, test where behavior warrants one, and a dedicated UX review before its consumer route is implemented.

---

## File Structure

| Path                                          | Responsibility                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/lib/format.js`                           | Small pure helpers shared by static club and Book Delivery UI.                |
| `eslint.config.js`                            | ESLint 9 flat configuration for SvelteKit source and generated-file ignores.  |
| `src/lib/content/club.js`                     | Current club content data, including intentional empty states.                |
| `src/lib/components/site/SiteHeader.svelte`   | Responsive global navigation without commerce controls.                       |
| `src/lib/components/site/SiteFooter.svelte`   | Reusable footer and social links.                                             |
| `src/lib/components/site/SectionIntro.svelte` | Consistent page title and introductory copy.                                  |
| `src/lib/components/site/ContentCard.svelte`  | Reusable link, workshop, event, and resource card shell.                      |
| `src/lib/components/site/EventList.svelte`    | Upcoming-event list with a helpful empty state.                               |
| `src/routes/+layout.svelte`                   | Shared app shell and header/footer composition.                               |
| `src/routes/+page.svelte`                     | Home page.                                                                    |
| `src/routes/about-us/+page.svelte`            | Club participation page.                                                      |
| `src/routes/our-workshops/+page.svelte`       | Workshop archive.                                                             |
| `src/routes/events/+page.svelte`              | Current events page.                                                          |
| `src/routes/resources/+page.svelte`           | Resource paths.                                                               |
| `src/routes/roadmap/+page.server.js`          | Permanent redirect from the obsolete roadmap path to `/events`.               |
| `src/styles.css`                              | Shared design tokens, typography, layout primitives, focus, and motion rules. |
| `src/test/setup.js`                           | Testing Library matcher setup.                                                |
| `vite.config.js`                              | SvelteKit and Vitest configuration.                                           |
| `package.json`                                | Quality and test commands.                                                    |

## Task 0: Make the existing Vercel build compatible with the local Node runtime

**Files:**

- Modify: `.gitignore`
- Modify: `svelte.config.js`

**Interfaces:**

- Produces: Vercel output targeted to supported `nodejs22.x` even when local development uses a newer Node release.
- Produces: no tracked `.vercel/output` build artifact.

- [ ] **Step 1: Record the failing baseline build evidence**

Run: `npm run build`

Expected before this task: the Vercel adapter rejects local Node 24 with `Building locally with unsupported Node.js version` after SvelteKit produces its initial bundle.

- [ ] **Step 2: Configure a supported Vercel runtime and ignore generated output**

Change the adapter configuration in `svelte.config.js` to:

```js
kit: {
	adapter: adapter({ runtime: 'nodejs22.x' });
}
```

Add this exact line to `.gitignore`:

```text
.vercel/
```

Do not add an `engines` range because this workspace currently uses Node 24 with `engine-strict=true`; the adapter runtime option is sufficient to produce a Node 22 Vercel function while retaining local tooling compatibility.

- [ ] **Step 3: Verify the adapter produces a Vercel output cleanly**

Run:

```bash
npm run build
git status --short
```

Expected: the build exits successfully and `.vercel/output` does not appear as an untracked file.

- [ ] **Step 4: Commit the compatibility fix**

```bash
git add .gitignore svelte.config.js
git commit -m "build: target a supported Vercel Node runtime"
```

## Task 1: Normalize the existing formatting baseline

**Files:**

- Modify: `.github/dependabot.yml`
- Modify: `docs/superpowers/specs/2026-08-01-club-and-book-delivery-design.md`
- Modify: `docs/superpowers/plans/2026-08-01-club-redesign-foundation.md`
- Modify: `docs/superpowers/plans/2026-08-01-book-catalogue-and-cart.md`
- Modify: `docs/superpowers/plans/2026-08-01-book-delivery-commerce-and-admin.md`
- Modify: `src/app.html`
- Modify: `src/lib/components/CardRow.svelte`
- Modify: `src/lib/components/ResourceCard.svelte`
- Modify: `src/lib/components/events/Event.svelte`
- Modify: `src/routes/+layout.js`
- Modify: `src/styles.css`
- Modify: `svelte.config.js`
- Modify: `.prettierignore`

**Interfaces:**

- Produces: a clean existing Prettier baseline without changing runtime behavior.
- Produces: the evidence for the separate ESLint 9 migration that immediately follows this task.
- Produces: no functional redesign or dependency change.

- [ ] **Step 1: Capture the inherited formatter failure**

Run: `npm run lint`

Expected before this task: Prettier reports exactly the listed legacy files as needing formatting. ESLint does not get a chance to run until Prettier exits cleanly.

- [ ] **Step 2: Apply formatting only to the known legacy files**

Run:

```bash
npx prettier --write .github/dependabot.yml docs/superpowers/specs/2026-08-01-club-and-book-delivery-design.md docs/superpowers/plans/2026-08-01-club-redesign-foundation.md docs/superpowers/plans/2026-08-01-book-catalogue-and-cart.md docs/superpowers/plans/2026-08-01-book-delivery-commerce-and-admin.md src/app.html src/lib/components/CardRow.svelte src/lib/components/ResourceCard.svelte src/lib/components/events/Event.svelte src/routes/+layout.js src/styles.css svelte.config.js
```

Review the diff. It must contain whitespace, indentation, quote, line-break, or trailing-comma changes only. Do not change copy, selectors, imports, component behavior, dependencies, or configuration values.

Add this exact `.prettierignore` line before the verification step so short-lived SDD briefs, reports, and review packages do not become formatter debt:

```text
.superpowers/
```

- [ ] **Step 3: Verify the clean Prettier baseline**

Run:

```bash
npx prettier --check .
git diff --check
```

Expected: both commands exit successfully. If a semantic-looking diff appears, revert only that edit using an inverse `apply_patch`, then rerun the two commands. Run `npm run lint` once to record the expected post-Prettier ESLint 9 configuration failure; do not repair it in this formatting-only task.

- [ ] **Step 4: Commit the nonfunctional baseline**

```bash
git add .github/dependabot.yml .prettierignore docs/superpowers/specs/2026-08-01-club-and-book-delivery-design.md docs/superpowers/plans/2026-08-01-club-redesign-foundation.md docs/superpowers/plans/2026-08-01-book-catalogue-and-cart.md docs/superpowers/plans/2026-08-01-book-delivery-commerce-and-admin.md src/app.html src/lib/components/CardRow.svelte src/lib/components/ResourceCard.svelte src/lib/components/events/Event.svelte src/routes/+layout.js src/styles.css svelte.config.js
git commit -m "style: normalize project formatting"
```

## Task 2: Migrate ESLint 9 to a durable flat configuration

**Files:**

- Create: `eslint.config.js`
- Delete: `.eslintrc.cjs`
- Delete: `.eslintignore`
- Modify: `package.json`

**Interfaces:**

- Produces: `npm run lint` that runs Prettier followed by ESLint 9 without legacy-config warnings or errors.
- Produces: Svelte recommended linting with generated Vercel/SvelteKit output, package artifacts, environment files, and dependencies ignored.
- Produces: a temporary warning-level `svelte/require-each-key` rule for legacy views; Task 8 restores it to an error after those views are replaced.

- [ ] **Step 1: Record the configuration failure after Prettier succeeds**

Run: `npm run lint`

Expected before this task: Prettier exits successfully and ESLint exits with the ESLint 9 missing-flat-config error. Do not use `ESLINT_USE_FLAT_CONFIG=false`; the installed Svelte plugin is flat-config-first and its legacy extension path is circular.

- [ ] **Step 2: Add direct config dependencies and replace the legacy configuration**

Run:

```bash
npm install -D @eslint/js@9.8.0 globals@14.0.0
```

Create `eslint.config.js` using `@eslint/js`, `eslint-plugin-svelte`'s `flat/recommended` configuration, `eslint-config-prettier`, and `globals`. Carry the intent of `.eslintignore` into an initial global `ignores` object, including `.vercel/**`, `.svelte-kit/**`, `build/**`, `package/**`, `node_modules/**`, and environment-file patterns. Use browser and Node globals, ECMAScript 2020, and module source type.

Delete `.eslintrc.cjs` and `.eslintignore`; ESLint 9 must not discover legacy configuration files. Because `eslint-config-prettier` disables core `no-unexpected-multiline`, explicitly restore that rule to `error` after the Prettier config. Add a final Svelte-only override that downgrades `svelte/require-each-key` to `warn` solely while the Task 8 legacy page/component replacement is pending. Do not disable any other recommended rule.

- [ ] **Step 3: Verify lint behavior and Svelte config resolution**

Run:

```bash
npm run lint
npx eslint --print-config src/routes/+page.svelte
npm run build
git diff --check
```

Expected: every command exits successfully. The printed config resolves Svelte rules, shows `svelte/require-each-key` at warning severity and `no-unexpected-multiline` at error severity; no generated `.vercel` output is linted.

- [ ] **Step 4: Commit the toolchain migration**

```bash
git add eslint.config.js package.json package-lock.json
git rm .eslintrc.cjs .eslintignore
git commit -m "build: migrate lint configuration"
```

## Task 3: Establish a testable, typed-JavaScript baseline

**Files:**

- Create: `jsconfig.json`
- Create: `src/lib/format.js`
- Create: `src/lib/format.test.js`
- Create: `src/test/setup.js`
- Modify: `package.json`
- Modify: `vite.config.js`

**Interfaces:**

- Produces: `formatCad(cents: number): string`, used by Book Delivery plans.
- Produces: `vite.config.js` test environment with `setupFiles: ['./src/test/setup.js']`.
- Produces: a full-source `npm run check` command that records the six inherited diagnostics in legacy views without excluding them; Task 8 removes those views and makes this command fully clean.

- [ ] **Step 1: Install the narrowly scoped quality dependencies**

Run:

```bash
npm install -D vitest jsdom svelte-check @testing-library/svelte @testing-library/jest-dom @testing-library/user-event
```

Add these scripts to `package.json`:

```json
{
	"check": "svelte-kit sync && svelte-check --tsconfig ./jsconfig.json",
	"test": "vitest run",
	"test:watch": "vitest"
}
```

- [ ] **Step 2: Write the failing currency-format test**

Create `src/lib/format.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { formatCad } from './format';

describe('formatCad', () => {
	it('formats integer cents as Canadian dollars', () => {
		expect(formatCad(7280)).toBe('$72.80');
	});

	it('formats zero cents without a negative zero', () => {
		expect(formatCad(0)).toBe('$0.00');
	});
});
```

- [ ] **Step 3: Run the focused test and verify it fails for the expected reason**

Run: `npm test -- src/lib/format.test.js`

Expected: FAIL because `./format` does not exist.

- [ ] **Step 4: Add the smallest reusable implementation and test configuration**

Create `src/lib/format.js`:

```js
export function formatCad(cents) {
	return new Intl.NumberFormat('en-CA', {
		style: 'currency',
		currency: 'CAD'
	}).format(cents / 100);
}
```

Create `jsconfig.json`:

```json
{
	"extends": "./.svelte-kit/tsconfig.json",
	"compilerOptions": {
		"allowJs": true,
		"checkJs": true,
		"strict": true
	},
	"include": ["src/**/*.js", "src/**/*.svelte", "vite.config.js"]
}
```

Create `src/test/setup.js`:

```js
import '@testing-library/jest-dom/vitest';
```

Extend `vite.config.js` without changing the existing SvelteKit plugin:

```js
test: {
	environment: 'jsdom',
	setupFiles: ['./src/test/setup.js'],
	include: ['src/**/*.{test,spec}.js']
}
```

- [ ] **Step 5: Verify the quality baseline and commit it**

Run:

```bash
npm test -- src/lib/format.test.js
npm run check
npm run lint
```

Expected: the focused test and lint pass. At this point `npm run check` is expected to report only the six pre-existing diagnostics in untouched legacy views (`SeeAlso.svelte`, `TopNav.svelte`, `EventCarousel.svelte`, `our-workshops/+page.svelte`, and `roadmap/+page.svelte`); it must report no diagnostic in the Task 3 files. Do not weaken `jsconfig.json` or exclude those files. Task 8 replaces or deletes every named legacy view and verifies a clean check.

Commit:

```bash
git add package.json package-lock.json vite.config.js jsconfig.json src/lib/format.js src/lib/format.test.js src/test/setup.js
git commit -m "test: add SvelteKit quality baseline"
```

## Task 4: Replace stale copy with a current, centralized club content model

**Files:**

- Create: `src/lib/content/club.js`
- Create: `src/lib/content/club.test.js`
- Modify: `src/lib/content.js`

**Interfaces:**

- Consumes: no runtime dependencies beyond JavaScript.
- Produces: `clubContent`, `getUpcomingEvents(events, today)` and `getWorkshopTracks(workshops)`.
- Produces: explicit empty events instead of invented or expired dates.

- [ ] **Step 1: Write failing tests for current-event and workshop grouping behavior**

Create `src/lib/content/club.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { getUpcomingEvents, getWorkshopTracks } from './club';

describe('getUpcomingEvents', () => {
	it('excludes an event that has already ended', () => {
		const events = [{ id: 'old', startsAt: '2024-08-19T09:00:00-04:00' }];
		expect(getUpcomingEvents(events, new Date('2026-08-01T12:00:00-04:00'))).toEqual([]);
	});
});

describe('getWorkshopTracks', () => {
	it('groups workshops by their named learning track', () => {
		const tracks = getWorkshopTracks([
			{ id: 'python-1', track: 'Python foundations' },
			{ id: 'web-1', track: 'Web development' }
		]);
		expect(Object.keys(tracks)).toEqual(['Python foundations', 'Web development']);
	});
});
```

- [ ] **Step 2: Run the content test and verify it fails**

Run: `npm test -- src/lib/content/club.test.js`

Expected: FAIL because `src/lib/content/club.js` does not exist.

- [ ] **Step 3: Create the focused content module**

Create `src/lib/content/club.js` with the following public shape:

```js
export const clubContent = {
	joinUrl: 'https://discord.gg/BMvrpKJjej',
	mission: 'A welcoming place to learn, build, and share software at Marianopolis.',
	events: [],
	workshops: [
		{
			id: 'intro-python',
			title: 'Intro to Python',
			track: 'Python foundations',
			description: 'Variables, values, conditions, and loops.',
			links: []
		}
	],
	resources: []
};

export function getUpcomingEvents(events, today = new Date()) {
	return events.filter((event) => new Date(event.startsAt) >= today);
}

export function getWorkshopTracks(workshops) {
	return workshops.reduce((tracks, workshop) => {
		tracks[workshop.track] = [...(tracks[workshop.track] ?? []), workshop];
		return tracks;
	}, {});
}
```

Migrate only still-valid links from `src/lib/content.js`. Remove Fall 2024 event, signup, and roadmap content rather than relabeling it as current.

- [ ] **Step 4: Run the focused tests and verify the legacy data no longer contains stale public copy**

Run:

```bash
npm test -- src/lib/content/club.test.js
rg -n "F24|Fall 2024|Winter 2024|coming soon" src
```

Expected: tests pass; `rg` returns no stale public copy.

- [ ] **Step 5: Commit the content model**

```bash
git add src/lib/content/club.js src/lib/content/club.test.js src/lib/content.js
git commit -m "refactor: centralize current club content"
```

## Task 5: Build the visual system and reusable content primitives

**Files:**

- Create: `src/lib/components/site/SectionIntro.svelte`
- Create: `src/lib/components/site/ContentCard.svelte`
- Create: `src/lib/components/site/ContentCard.test.js`
- Modify: `src/styles.css`
- Modify: `src/app.html`

**Interfaces:**

- Produces: `SectionIntro` with `eyebrow`, `title`, and `summary` props.
- Produces: `ContentCard` with `title`, `summary`, `href`, `meta`, and `variant` props.
- Produces: token classes `surface-paper`, `surface-navy`, `button-primary`, and `button-secondary`.

- [ ] **Step 1: Write a failing component test for a keyboard-accessible content card**

Create `src/lib/components/site/ContentCard.test.js`:

```js
import { render, screen } from '@testing-library/svelte';
import { expect, it } from 'vitest';
import ContentCard from './ContentCard.svelte';

it('renders its complete card as one descriptive link', () => {
	render(ContentCard, {
		props: {
			title: 'Python foundations',
			summary: 'Start with the basics.',
			href: '/our-workshops'
		}
	});
	const link = screen.getByRole('link', { name: /python foundations.*start with the basics/i });
	expect(link).toHaveAttribute('href', '/our-workshops');
});
```

- [ ] **Step 2: Run the component test and verify it fails**

Run: `npm test -- src/lib/components/site/ContentCard.test.js`

Expected: FAIL because `ContentCard.svelte` does not exist.

- [ ] **Step 3: Implement the primitives and token system**

`ContentCard.svelte` must use one `<a>` when `href` is supplied rather than nesting links. Its key structure is:

```svelte
<svelte:element this={href ? 'a' : 'article'} class:content-card-link={href} {href}>
	<p class="card-meta">{meta}</p>
	<h3>{title}</h3>
	<p>{summary}</p>
</svelte:element>
```

Replace the global styles with custom properties and explicit focus behavior:

```css
:root {
	--midnight: #050d2e;
	--club-blue: #0d2173;
	--sky: #99c2ff;
	--paper: #f7f4ed;
	--graphite: #181b25;
	--coral: #df5b48;
}

:focus-visible {
	outline: 3px solid var(--coral);
	outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
	*,
	*::before,
	*::after {
		scroll-behavior: auto;
		transition-duration: 0.01ms;
		animation-duration: 0.01ms;
	}
}
```

Remove the Bootstrap CDN stylesheet and script from `src/app.html`; components must not rely on Bootstrap JavaScript for navigation or behavior.

- [ ] **Step 4: Verify components, lint, and focus styles**

Run:

```bash
npm test -- src/lib/components/site/ContentCard.test.js
npm run check
npm run lint
```

Expected: all commands pass. Manually keyboard-tab through a temporary local render and confirm an orange focus ring is visible.

- [ ] **Step 5: Commit the design foundation**

```bash
git add src/styles.css src/app.html src/lib/components/site
git commit -m "feat: add club visual system and content primitives"
```

## Task 6: Replace the shared shell with a responsive, accessible club header and footer

**Files:**

- Create: `src/lib/components/site/SiteHeader.svelte`
- Create: `src/lib/components/site/SiteHeader.test.js`
- Create: `src/lib/components/site/SiteFooter.svelte`
- Modify: `src/routes/+layout.svelte`
- Modify: `src/lib/content/club.js`
- Delete: `src/lib/components/TopNav.svelte`
- Delete: `src/lib/components/Footer.svelte`

**Interfaces:**

- Consumes: `clubContent.joinUrl` and SvelteKit `$page` data.
- Produces: a `SiteHeader` whose navigation contains `/books` but no cart button.

- [ ] **Step 1: Write the failing navigation test**

Create `src/lib/components/site/SiteHeader.test.js`:

```js
import { render, screen } from '@testing-library/svelte';
import { expect, it } from 'vitest';
import SiteHeader from './SiteHeader.svelte';

it('links to Book Delivery without leaking a cart into club navigation', () => {
	render(SiteHeader, { props: { pathname: '/' } });
	expect(screen.getByRole('link', { name: 'Book Delivery' })).toHaveAttribute('href', '/books');
	expect(screen.queryByRole('link', { name: /cart/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the header test and verify it fails**

Run: `npm test -- src/lib/components/site/SiteHeader.test.js`

Expected: FAIL because `SiteHeader.svelte` does not exist.

- [ ] **Step 3: Implement header, mobile menu, footer, and layout composition**

`SiteHeader.svelte` must use a native button with `aria-expanded` and a single `nav` landmark. Its nav configuration is:

```js
const links = [
	{ label: 'Club', href: '/about-us' },
	{ label: 'Workshops', href: '/our-workshops' },
	{ label: 'Events', href: '/events' },
	{ label: 'Resources', href: '/resources' },
	{ label: 'Book Delivery', href: '/books' }
];
```

Use the existing logo assets and Discord URL. `SiteFooter.svelte` retains the existing social destinations, ensures external links use `target="_blank" rel="noreferrer"`, and has a current copyright line without a dated claim. Update `+layout.svelte` to render the new components around `<slot />` and pass `$page.url.pathname` to the header.

- [ ] **Step 4: Verify navigation behavior and legacy component removal**

Run:

```bash
npm test -- src/lib/components/site/SiteHeader.test.js
npm run check
npm run lint
rg -n "TopNav|Footer" src/routes src/lib/components --glob '!src/lib/components/site/SiteFooter.svelte'
```

Expected: test and quality checks pass; the search has no obsolete component references.

- [ ] **Step 5: Commit the shell replacement**

```bash
git add src/routes/+layout.svelte src/lib/components/site src/lib/content/club.js
git rm src/lib/components/TopNav.svelte src/lib/components/Footer.svelte
git commit -m "feat: redesign shared club navigation"
```

## Task 7: Deliver the refreshed home and club introduction pages

**Files:**

- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/about-us/+page.svelte`
- Create: `src/routes/+page.test.js`
- Create: `src/routes/about-us/+page.test.js`
- Modify: `src/lib/content/club.js`

**Interfaces:**

- Consumes: `clubContent.mission`, `clubContent.events`, workshops, and join URL.
- Produces: content-led pages that show useful empty states instead of stale dates.

- [ ] **Step 1: Write failing home and about-page tests**

Create `src/routes/+page.test.js`:

```js
import { render, screen } from '@testing-library/svelte';
import { expect, it } from 'vitest';
import Home from './+page.svelte';

it('offers a direct path to upcoming events when the calendar is empty', () => {
	render(Home);
	expect(screen.getByText(/new events are being planned/i)).toBeInTheDocument();
	expect(screen.getByRole('link', { name: /view events/i })).toHaveAttribute('href', '/events');
});
```

Create `src/routes/about-us/+page.test.js` asserting that a Discord join link is present and that the club description mentions beginners.

- [ ] **Step 2: Run the page tests and verify they fail**

Run: `npm test -- src/routes/+page.test.js src/routes/about-us/+page.test.js`

Expected: FAIL because the old pages do not render the new copy or event empty state.

- [ ] **Step 3: Implement the two content-led pages**

Home must include, in this order: a compact statement of purpose, a primary Discord action, a next-workshop or workshop-path card, an upcoming-events block, and a Book Delivery introduction that links to `/books` without showing cart controls. About must clarify that beginners are welcome and use the existing club-activity SVG only if it still supports the updated story.

Use `SectionIntro` and `ContentCard`; do not recreate page-specific button or card styles.

- [ ] **Step 4: Verify page behavior, metadata, and responsive layout**

Run:

```bash
npm test -- src/routes/+page.test.js src/routes/about-us/+page.test.js
npm run check
npm run lint
npm run build
```

Expected: all commands pass. Inspect at 375px and 1440px wide; no horizontal scroll, clipped headings, or card overflow.

- [ ] **Step 5: Commit the main club pages**

```bash
git add src/routes/+page.svelte src/routes/about-us/+page.svelte src/routes/+page.test.js src/routes/about-us/+page.test.js src/lib/content/club.js
git commit -m "feat: refresh club home and about pages"
```

## Task 8: Rebuild workshops, events, resources, and the obsolete roadmap route

**Files:**

- Create: `src/lib/components/site/EventList.svelte`
- Create: `src/lib/components/site/EventList.test.js`
- Modify: `src/routes/our-workshops/+page.svelte`
- Create: `src/routes/events/+page.svelte`
- Modify: `src/routes/resources/+page.svelte`
- Create: `src/routes/roadmap/+page.server.js`
- Delete: `src/routes/roadmap/+page.svelte`
- Delete: `src/lib/components/Card.svelte`
- Delete: `src/lib/components/CardRow.svelte`
- Delete: `src/lib/components/ResourceCard.svelte`
- Delete: `src/lib/components/SeeAlso.svelte`
- Delete: `src/lib/components/events/Event.svelte`
- Delete: `src/lib/components/events/EventCarousel.svelte`
- Modify: `eslint.config.js`

**Interfaces:**

- Consumes: `clubContent`, `getUpcomingEvents`, `getWorkshopTracks`, `ContentCard`.
- Produces: `/events` and a permanent `/roadmap` redirect.
- Resolves: the known legacy `svelte-check` diagnostics by replacing or deleting every affected view.

- [ ] **Step 1: Write the failing event empty-state test**

Create `src/lib/components/site/EventList.test.js`:

```js
import { render, screen } from '@testing-library/svelte';
import { expect, it } from 'vitest';
import EventList from './EventList.svelte';

it('guides visitors when no events are scheduled', () => {
	render(EventList, { props: { events: [] } });
	expect(screen.getByText(/new events are being planned/i)).toBeInTheDocument();
	expect(screen.getByRole('link', { name: /join the discord/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/lib/components/site/EventList.test.js`

Expected: FAIL because `EventList.svelte` does not exist.

- [ ] **Step 3: Implement pages and deliberate legacy redirect**

`EventList.svelte` must render dates using `<time datetime={event.startsAt}>` for non-empty input and render the specified empty state otherwise. Workshop cards must use `getWorkshopTracks` and existing valid material links. Resources must be grouped as practical learning paths rather than the legacy Bootstrap card grid.

Create `src/routes/roadmap/+page.server.js`:

```js
import { redirect } from '@sveltejs/kit';

export function load() {
	throw redirect(308, '/events');
}
```

Replace all imports of legacy generic components before deleting them. Once every remaining `#each` block has a stable key, restore `svelte/require-each-key` to `error` in `eslint.config.js`; do not leave the transitional warning override in the finished redesign.

- [ ] **Step 4: Verify all public pages and the redirect**

Run:

```bash
npm test -- src/lib/components/site/EventList.test.js
npm run check
npm run lint
npx eslint . --max-warnings 0
npm run build
```

Expected: all commands pass without ESLint warnings. With `npm run dev`, request `/roadmap` and confirm it returns a permanent redirect to `/events`.

- [ ] **Step 5: Commit the content-page redesign**

```bash
git add src/routes src/lib/components/site src/lib/content/club.js eslint.config.js
git rm src/lib/components/Card.svelte src/lib/components/CardRow.svelte src/lib/components/ResourceCard.svelte src/lib/components/SeeAlso.svelte src/lib/components/events/Event.svelte src/lib/components/events/EventCarousel.svelte src/routes/roadmap/+page.svelte
git commit -m "feat: rebuild club content pages"
```

## Task 9: Complete visual and accessibility regression coverage

**Files:**

- Create: `tests/e2e/club-navigation.spec.js`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**

- Consumes: running Vite app and stable accessible names from Tasks 5-7.
- Produces: a repeatable desktop and mobile smoke test command.

- [ ] **Step 1: Install Playwright and add the browser-test script**

Run:

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Add:

```json
"test:e2e": "playwright test"
```

to `package.json`, plus a `playwright.config.js` that starts `npm run dev -- --host 127.0.0.1` and uses `http://127.0.0.1:5173`.

- [ ] **Step 2: Write a failing navigation and mobile-width test**

Create `tests/e2e/club-navigation.spec.js`:

```js
import { expect, test } from '@playwright/test';

test('club pages do not expose a cart and Book Delivery is reachable', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('link', { name: 'Book Delivery' })).toHaveAttribute('href', '/books');
	await expect(page.getByRole('link', { name: /cart/i })).toHaveCount(0);
});

test('the home page has no horizontal overflow on a phone', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto('/');
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
```

- [ ] **Step 3: Run the browser test and verify any failure is a real regression**

Run: `npm run test:e2e -- tests/e2e/club-navigation.spec.js`

Expected: PASS after Tasks 5-7. If it fails, correct the named accessible control or overflow instead of weakening the assertion.

- [ ] **Step 4: Document local verification**

Replace the generated starter documentation with a concise project-specific `README.md` section explaining:

```text
npm install
npm run dev
npm run check
npm run lint
npm test
npm run test:e2e
npm run build
```

State that current club content is maintained in `src/lib/content/club.js` until the planned executive content tooling is added.

Delete `docs/svelte.md`; its create-Svelte instructions no longer describe this project.

- [ ] **Step 5: Run the full quality gate and commit**

Run:

```bash
npm run check
npm run lint
npm test
npm run test:e2e
npm run build
```

Expected: all commands pass.

Commit:

```bash
git add package.json package-lock.json playwright.config.js tests/e2e/club-navigation.spec.js README.md
git rm docs/svelte.md
git commit -m "test: cover redesigned club experience"
```

## Plan self-review

- Spec coverage: formatting and lint baselines, shared visual system, club home/about/workshops/events/resources, current content, Book Delivery discoverability, cart isolation, accessibility, responsiveness, and stale-content removal map to Tasks 1-9.
- Intentional boundary: Book Delivery catalogue, cart behavior, checkout, payments, order emails, and admin operation are implemented in the two companion plans so this plan delivers a coherent non-commerce site on its own.
- Type consistency: `formatCad`, `clubContent`, `getUpcomingEvents`, `getWorkshopTracks`, `ContentCard`, and `EventList` are defined before their planned consumers.
