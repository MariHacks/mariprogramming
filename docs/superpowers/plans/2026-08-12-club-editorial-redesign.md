# Club editorial redesign implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the toy-like club and Book Delivery interface with the approved Student Technical Journal system, keeping every existing flow functional.

**Architecture:** Keep SvelteKit route and data boundaries intact. Establish shared visual tokens and site chrome first, then redesign each route in its existing component boundary. Preserve transactional logic and change only markup, student-facing copy, and styling unless a test exposes a behavior gap.

**Tech Stack:** SvelteKit, Svelte 5, JavaScript, Vitest, Testing Library, Playwright, CSS custom properties.

**Spec:** `PRODUCT.md`, `DESIGN.md`, `.impeccable/briefs/club-redesign.md`, and `.impeccable/comps/homepage-approved.png`

## Global Constraints

- The homepage recruits Programming Club members before introducing Book Delivery.
- The top-right primary action is `Sign up` and opens `https://docs.google.com/forms/d/e/1FAIpQLSdg_pUZ286RhYV8Cyi1O0i6IQog-cbiH-ktiLM1gU2ZuXEx6w/viewform`.
- Instagram and Discord are accessible icon links. Discord uses `https://discord.gg/c6JJw9d`.
- Use cool white, ink navy, quiet gray, and one electric blue. Do not use beige, warm parchment, pastel section bands, gradients, cartoon illustration, or decorative coding motifs.
- Use open editorial composition, rules, and columns. Do not use repeated rounded cards as page structure.
- Keep Inter Tight for display, Inter for body and controls, and Roboto Mono only for literal code, course codes, and order references.
- Run every new or changed student-facing string through Humanizer in embedded mode. Preserve factual, validation, pricing, payment, receipt, and pickup meaning. Final UI copy contains no em dash or en dash.
- Preserve existing workshop, resource, course, cart, Stripe, receipt, and pickup behavior.
- Motion must explain feedback, continuity, or state. Press feedback is 100 to 150 ms; routine transitions are 150 to 300 ms; reduced motion uses short opacity or color changes.
- Cart navigation appears only within Book Delivery.
- One Book Delivery catalogue entry represents one teacher and one course.
- Course detail allows individual books to be selected or excluded and includes each bookstore link.
- Checkout and confirmation show Wayne's Front Desk at Marianopolis College; course detail does not show pickup information.
- Do not introduce unverified event dates, meeting schedules, statistics, testimonials, course data, or club claims.
- Write a failing test before each behavior or copy contract change, verify the expected failure, implement, and rerun the focused tests.

---

### Task 1: Shared editorial system and site chrome

**Files:**

- Modify: `src/styles.css`
- Modify: `src/lib/content/club.js`
- Modify: `src/lib/components/site/SiteHeader.svelte`
- Modify: `src/lib/components/site/SiteHeader.test.js`
- Modify: `src/lib/components/site/SiteFooter.svelte`
- Modify: `src/lib/components/site/SiteFooter.test.js`
- Modify: `src/routes/+layout.svelte`

**Interfaces:**

- Produces shared color, spacing, type, rule, focus, press, and layout primitives consumed by every later task.
- Produces `clubContent.signupUrl` and Discord social metadata.

- [ ] Add failing header/content tests for the exact Sign up URL, Discord URL, accessible Instagram and Discord icon names, and the absence of a global cart link outside `/books`.
- [ ] Run `npm test -- src/lib/components/site/SiteHeader.test.js src/lib/components/site/SiteFooter.test.js src/lib/content/club.test.js` and confirm the new assertions fail for missing destinations or structure.
- [ ] Implement the compact editorial header and footer, using inline or existing SVG icons, one top-right Sign up button, visible focus, and no text-only social CTA.
- [ ] Replace global toy-like tokens with the Student Technical Journal palette, typography, rules, restrained radii, focus, and press states without changing route logic.
- [ ] Rerun the focused tests, `npm run check`, and `npx prettier --check` for the modified files.

### Task 2: Recruitment homepage

**Files:**

- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/home.page.test.js`
- Modify only if still used: `src/lib/components/site/ContentCard.svelte`

**Interfaces:**

- Consumes the shared editorial tokens and verified destinations from Task 1.
- Produces the approved asymmetric recruitment viewport, evidence column, ruled activity index, workshop evidence, and Book Delivery cover strip.

- [ ] Add failing tests for one `Sign up` action, `Programming Hub`, `Workshops`, `MariHacks`, beginner accessibility, and a secondary Book Delivery destination. Assert that no invented event date, metric, or card-grid copy appears.
- [ ] Run `npm test -- src/routes/home.page.test.js` and confirm the new structure or text assertions fail.
- [ ] Implement the approved composition using only factual existing content. Keep the opening statement concise, show useful next destinations immediately, and avoid decorative cards or oversized empty spacing.
- [ ] Run Humanizer embedded mode over every changed visible string, then scan the route for em dash, en dash, filler, and promotional claims.
- [ ] Rerun the focused test, check, lint, formatting, and desktop/mobile visual inspection.

### Task 3: About, events, workshops, and resources

**Files:**

- Modify: `src/routes/about-us/+page.svelte`
- Modify: `src/routes/about-us/page.test.js`
- Modify: `src/routes/events/+page.svelte`
- Modify: `src/routes/events/page.test.js`
- Modify: `src/routes/our-workshops/+page.svelte`
- Modify: `src/routes/our-workshops/page.test.js`
- Modify: `src/routes/resources/+page.svelte`
- Modify: `src/routes/resources/page.test.js`
- Modify as needed: `src/lib/components/site/EventList.svelte`
- Modify as needed: `src/lib/components/site/SectionIntro.svelte`

**Interfaces:**

- Consumes shared editorial type, rules, spacing, and focus primitives.
- Produces compact editorial indexes that remain useful when event content is sparse.

- [ ] Add failing tests for concise factual introductions, preserved workshop/resource destinations, and the factual empty-event state `No upcoming events are listed.`
- [ ] Run all four route tests and confirm the changed contracts fail where the old structures remain.
- [ ] Replace repeated panels and cards with reading columns, ruled archive rows, and direct destinations. Remove copy that repeats headings or does not help a student decide or act.
- [ ] Run Humanizer embedded mode over every changed visible string and verify no em dash, en dash, stale date, or unsupported claim remains.
- [ ] Rerun focused tests, check, formatting, and visual inspection at desktop and 390 px.

### Task 4: Book Delivery shell, catalogue, and course detail

**Files:**

- Modify: `src/routes/books/+layout.svelte`
- Modify: `src/lib/books/BookDeliveryBar.svelte`
- Modify: `src/routes/books/+page.svelte`
- Modify: `src/routes/books/page.test.js`
- Modify: `src/lib/books/TeacherCard.svelte`
- Modify: `src/lib/books/TeacherCard.test.js`
- Modify: `src/routes/books/[teacherSlug]/[courseId]/+page.svelte`
- Modify: `src/routes/books/[teacherSlug]/[courseId]/page.test.js`
- Modify: `src/lib/books/BookCover.svelte`
- Modify: `src/lib/books/BookCoverStack.svelte`
- Modify: `src/lib/books/BookRow.svelte`
- Modify their focused tests when visible contracts change.

**Interfaces:**

- Preserves loader, selection, cart, price, and bookstore-link behavior.
- Produces one open teacher-course composition per entry and a compact selectable book index.

- [ ] Add failing tests for one teacher-course entry per course, full-card accessible navigation, visible cover imagery, individual selection controls, storefront links, and the absence of pickup copy on detail.
- [ ] Run the catalogue, teacher card, course detail, cover, stack, and row tests and confirm the new structure fails before implementation.
- [ ] Implement a clean bookstore-like catalogue using open columns and cover stacks, then redesign detail as a ruled selectable list with price and source information aligned for scanning.
- [ ] Keep cart controls inside Book Delivery and preserve current selection behavior exactly.
- [ ] Run Humanizer embedded mode over changed visible strings and verify no ornamental labels or em/en dashes remain.
- [ ] Rerun focused tests, check, formatting, and populated/empty visual inspection at desktop and mobile.

### Task 5: Cart and totals

**Files:**

- Modify: `src/routes/books/cart/+page.svelte`
- Modify: `src/routes/books/cart/page.test.js`
- Modify: `src/lib/books/BookstoreCartGroup.svelte`
- Modify: `src/lib/books/BookstoreCartGroup.test.js`
- Modify: `src/lib/books/CartTotals.svelte`
- Modify: `src/lib/books/CartTotals.test.js`

**Interfaces:**

- Preserves grouping by bookstore, quantity/removal controls, per-bookstore service fee, subtotal, tax, and total calculations.
- Produces a dense ledger-like cart without nested cards.

- [ ] Add failing assertions for useful empty-state actions, bookstore grouping, service-fee explanation, quantity/removal names, and all money-line labels.
- [ ] Run the cart, group, and totals tests and confirm expected failures.
- [ ] Implement ruled bookstore groups and a compact totals ledger. Keep destructive actions distinct and keyboard accessible.
- [ ] Run Humanizer embedded mode over changed visible strings without changing calculation or recovery meaning.
- [ ] Rerun focused tests, check, formatting, and populated/empty visual inspection.

### Task 6: Guest checkout and pickup review

**Files:**

- Modify: `src/routes/books/checkout/+page.svelte`
- Modify: `src/routes/books/checkout/page.test.js`
- Modify: `src/lib/books/GuestCheckoutForm.svelte`
- Modify: `src/lib/books/GuestCheckoutForm.test.js`
- Modify: `src/lib/books/PickupMap.svelte`
- Modify: `src/lib/books/PickupMap.test.js`

**Interfaces:**

- Preserves validation, hosted Stripe checkout, error and processing states, amount lines, and pickup map semantics.
- Produces an edge-to-edge bright form pane with a deep-ink order and pickup rail.

- [ ] Add failing tests for the two task regions, field labels/errors, hosted-payment explanation, every price line, Wayne's Front Desk, Marianopolis address, map title, and Open in Maps action.
- [ ] Run checkout, form, and map tests and confirm the structural assertions fail before implementation.
- [ ] Implement the high-contrast two-column workspace close to the user's checkout reference, with compact content and no oversized rounded outer card.
- [ ] Keep payment state feedback immediate, disable duplicate submission while processing, and maintain aria-live recovery messages.
- [ ] Run Humanizer embedded mode over changed visible strings while keeping secure-payment, validation, price, and pickup facts exact.
- [ ] Rerun focused tests, check, formatting, and filled/invalid/mobile visual inspection.

### Task 7: Order confirmation and payment recovery

**Files:**

- Modify: `src/routes/books/order-confirmation/+page.svelte`
- Modify: `src/routes/books/order-confirmation/page.test.js`
- Modify only if required by a behavior test: `src/routes/books/order-confirmation/+page.server.js`

**Interfaces:**

- Preserves payment verification, receipt email, order reference, order lines, recovery states, manual purchase note, and pickup map.
- Produces a receipt-like confirmation aligned with checkout's two-column system.

- [ ] Add failing tests for confirmed, processing, and recovery states; receipt email; order reference; manual purchasing note; pickup facts; and Browse courses actions.
- [ ] Run confirmation route and server tests and confirm only the new presentation contracts fail.
- [ ] Implement a compact receipt workspace with one clear state heading, ruled order lines, and a restrained operational note.
- [ ] Run Humanizer embedded mode over changed visible strings without weakening recovery or receipt information.
- [ ] Rerun focused tests, check, formatting, and confirmed/recovery/mobile visual inspection.

### Task 8: Motion, copy, accessibility, and whole-site verification

**Files:**

- Modify only files named by evidence from the read-only motion and copy audits.
- Update: `DESIGN.md`
- Create: `.impeccable/design.json`
- Update relevant unit/E2E tests for verified final contracts.

**Interfaces:**

- Consumes all completed pages.
- Produces the final motion vocabulary, fully humanized UI copy, exact settled design tokens, and regression evidence.

- [ ] Run the find-animation-opportunities skill read-only across the built interface. Gate each candidate by frequency, purpose, speed, and function, and record rejected candidates.
- [ ] Add failing tests for any chosen state or accessibility behavior before implementing it.
- [ ] Implement at most five high-leverage motion behaviors using shared 100 to 300 ms tokens, pointer-down feedback, symmetric paths, and reduced-motion cross-fades. Do not animate dense lists, prices, maps, or routine reading content.
- [ ] Run Humanizer in embedded mode over every student-facing string in `src`, preserving external titles, proper names, codes, prices, validation, payment, receipt, and pickup facts. Scan for em dash and en dash.
- [ ] Verify visible focus, target sizes, contrast, zoom, keyboard paths, semantic headings, status announcements, and mobile reading order.
- [ ] Run the complete unit suite, `npm run check`, lint, Prettier, build, focused Playwright flows, `git diff --check`, and the Impeccable detector.
- [ ] Visually inspect home, all club pages, catalogue, course detail, populated/empty cart, checkout states, and confirmation at desktop and 390 px. Fix material gaps and rerun affected checks.
- [ ] Refresh `DESIGN.md` with exact tokens and generate `.impeccable/design.json` from the implementation.
