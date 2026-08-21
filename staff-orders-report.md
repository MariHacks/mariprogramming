# Staff order operations report

## Outcome

The protected staff portal now has a complete order workflow for book delivery. Staff can work from a newest-first actionable queue, search by an exact order reference or full email address, inspect a protected receipt, move paid orders through fulfillment, cancel an unpaid Stripe Checkout Session, and download a bookstore purchase list.

The interface uses the Programming Club identity, the light-bulb mark, flat ruled layouts, compact status labels, and one clear next action. It was checked at desktop and 320 px widths without horizontal overflow.

## What staff can do

- View paid orders that still need purchasing, receiving, pickup preparation, or pickup.
- Filter by payment and fulfillment state in pages of at most 25 orders.
- Search by exact public reference or exact full email through a POST form. Search terms never enter the URL.
- Open a protected detail view with the full customer record, immutable receipt grouped by bookstore, Stripe lookup IDs, current retailer links, totals, and allowlisted history.
- Advance fulfillment through the server-owned sequence: unstarted, purchasing, received, ready for pickup, and picked up.
- Cancel only an unpaid, unstarted order whose Stripe Checkout Session is ready or already expired. The portal does not expose a staff refund action.
- Export paid, unstarted book quantities as a fixed four-column CSV grouped by saved bookstore and book facts.

## Security and data handling

- Every load, action, search, cancellation, and export reauthorizes the staff session.
- Every POST uses the shared exact-origin, bounded-body guard and separate committed session and action rate limits.
- Fulfillment and cancellation use versioned compare-and-set writes. The resulting state change and audit record commit atomically.
- A cancellation commits a short seed read, calls Stripe outside a database transaction, validates the returned Session, then commits a short locked update. Provider errors do not change the database, and a paid webhook race wins.
- Refund states preserve completed fulfillment history but block any new fulfillment step.
- Picked-up and cancelled orders receive a server-owned PII purge date.
- Ledger rows expose only masked email addresses. Full customer data appears only on the protected detail route.
- The export contains bookstore, title, ISBN, and quantity only. It omits customer data, order references, provider IDs, capabilities, and internal identifiers.
- CSV cells use RFC 4180 encoding and neutralize formula prefixes, including prefixes hidden behind whitespace or control characters.
- The order table now has a cross-state payment and fulfillment check plus indexes for the staff ledger and exact email search.

## Verification evidence

- `npx vitest run --coverage`: 91 test files and 1,815 tests passed. Statements, branches, functions, and lines are all 100%.
- Real PostgreSQL tests apply every migration and cover staff reads, exact search, export aggregation, concurrent fulfillment, compare-and-set races, audit rollback, cancellation atomicity, and a paid webhook race.
- `npm run check`: 0 errors and 0 warnings.
- `npm run build`: production build passed.
- Scoped Prettier and ESLint checks passed for every staff-order file. Existing repository-wide navigation lint outside this work unit remains owned by the public-site work.
- Installed Google Chrome 151 checked the ledger and detail routes at 1440 px and 320 px, plus reduced-motion and forced-colors rendering. Both routes returned 200, had no console errors, and had no horizontal overflow.
- The Impeccable detector found three side-accent warning styles on status messages. Those accents were replaced with restrained full borders. The Chrome pass also caught an invisible white light-bulb mark on the white staff header, which was corrected and regression-tested.
- Fresh independent review found one ledger masking edge case: a one-character email local part remained visible. The repository now masks that local part completely, and the new regression passed the focused and full suites.
- A final scan found no long dash or middle-dot characters in the staff-order surface and no unsafe HTML, dynamic code execution, debug logging, or export-field leaks.
- The independent post-fix review returned APPROVE with no remaining security, privacy, correctness, accessibility, responsive-layout, or scope findings.

## Scope boundary

This work unit does not add refund controls, a reconciliation job, a retention scheduler, global response headers, or deployment changes. Those remain separate work units. The implementation passed fresh independent review and has not been committed.
