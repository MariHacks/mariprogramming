# Secure confirmation work unit report

Date: 2026-08-13

Scope: WU8, capability-authorized persisted order confirmation

## Outcome

The order confirmation flow now reads one immutable persisted order through a public-reference route and a matching secure browser capability. It does not treat a Stripe query parameter, redirect, or provider response as payment authority. Payment and refund presentation comes only from the order state written by the signed webhook flow.

No deployment, staff CRUD, retention job, or unrelated response-header work was included.

## Security design

- Stripe returns to `/books/order-confirmation/MPC-...`. The route contains only a public order reference.
- Checkout sets a reference-scoped `Secure`, `HttpOnly`, `SameSite=Lax` confirmation cookie. The cookie path is limited to `/books/order-confirmation`.
- The database stores only the SHA-256 capability hash and expiry. The plaintext capability is not persisted, logged, put in a URL, rendered into HTML, or included in client assets.
- The confirmation loader reads the exact cookie selected by the route reference. The repository then performs a timing-safe hash comparison against that order's persisted hash.
- Missing, malformed, forged, cross-order, expired, duplicate, or corrupt data fails to one generic unavailable model. Receipt facts are never returned before authorization.
- The repository issues `SELECT` statements only. A confirmation `GET` cannot update payment, fulfillment, checkout-attempt, or provider state.
- Every confirmation response sets `private, no-cache, no-store, max-age=0, must-revalidate`, `Expires: 0`, `Pragma: no-cache`, `X-Robots-Tag: noindex, nofollow`, and `Referrer-Policy: no-referrer`. Matching page metadata supplies `noindex, nofollow` and `no-referrer` as defense in depth.
- The UI receives only the public reference, masked email, immutable line snapshots, exact CAD amounts, fulfillment state, and a narrowly scoped browser cleanup instruction.

## Browser cleanup and concurrency

- Paid and partially refunded confirmations subtract only the purchased quantity for each exact course and book pair.
- Unrelated books, concurrent orders, and any extra quantity remain in the cart.
- The cart update and consumed-order marker share one local-storage write. A repeated confirmation is idempotent.
- Browser tabs serialize every persisted cart read, modify, and write operation through one `mpc:book-cart:${storageKey}` Web Locks namespace. This includes hydration, adding, selection, quantity, reconciliation, clearing, and terminal order cleanup.
- Every operation reads the latest persisted envelope only after acquiring the lock. Later cart changes retain consumption markers, and confirmation cleanup cannot erase a newer add, selection, quantity, or unrelated order change.
- If a production browser cannot supply cross-tab locking, or if a lock request fails, persisted mutation fails closed without changing local storage or in-memory state.
- A storage read error also fails closed before any write. Hydration, ordinary mutations, reconciliation, and confirmation cleanup never fall back to empty or stale state when `localStorage.getItem` throws.
- Production callers await mutations in order. Mount hydration and reactive reconciliation use guarded async helpers, so no cart write is left as an unsequenced promise.
- The session checkout request is retired only when its value exactly matches the authorized order's request ID. A newer request remains intact.
- When selective cart cleanup cannot complete, the matching request ID is kept so a later confirmation visit can retry safely.
- Confirmation cleanup tracks in-flight and completed order references separately. A reference is completed only after both cart consumption and matching request retirement succeed.
- Browser storage access is contained by an awaited cleanup wrapper. A blocked `sessionStorage` accessor cannot create an unhandled rejection or retire the request ID.
- A failed cleanup is attempted at most once per page-data render. A later rerender can retry, while the cart consumption marker makes that retry idempotent and a completed reference prevents duplicate cleanup.
- Refunded, expired, failed, and cancelled orders preserve cart items while retiring only the matching terminal request ID.

## Presentation

- Paid, processing, partially refunded, refunded, expired, failed, and cancelled states have separate factual headings and recovery copy.
- The receipt shows masked email, public order reference, fulfillment status, course and bookstore context, quantity, unit amount, line amount, per-bookstore service fee, tax, total, refund amount, and net paid where relevant.
- The manual purchasing note is concise and remains accurate across fulfillment states.
- The Marianopolis College map and Wayne's Front Desk pickup location appear only for a paid confirmation in this route.
- The page uses the existing editorial checkout language: flat rules, a high-contrast summary rail, restrained status motion, responsive single-column collapse, keyboard-sized actions, forced-colors support, and reduced-motion handling.
- Copy was reviewed under the Humanizer rules. UI copy contains no em dash, en dash, or middle-dot separator.
- The Impeccable detector returned no findings for the confirmation UI and browser cleanup modules.

## TDD evidence

Each seam started with an observed failing test before implementation:

1. Narrow confirmation environment parser: missing export failed, then 99 parser tests passed.
2. Confirmation repository: missing module failed, then capability, corruption, state, and immutable-line tests passed.
3. Route loader: missing factory and legacy Stripe authority failed, then generic recovery and header tests passed.
4. Public-reference Stripe success route and cookie routing: old fixed success URL and cookie expectations failed, then passed with the dynamic reference.
5. Request ID retirement: six missing-function tests failed, then 17 tests passed.
6. Selective cart consumption: eight missing-method tests failed, then selective, idempotent, concurrency, lock failure, and persistence failure cases passed.
7. Confirmation page: eleven legacy-model tests failed against the persisted state model, then the full state and cleanup suite passed.
8. Dynamic confirmation route: missing route modules failed, then shared loader and component tests passed.
9. Disposable PostgreSQL: real migrations, capability matching, exact-expiry rejection, concurrent authorized reads, and no-mutation assertions passed.
10. Independent review race: two deterministic tests first reproduced cleanup overwriting a concurrent add and cleanup overwriting concurrent quantity and selection changes. Both failed against the unlocked ordinary-write path, then passed after all persisted mutations joined the shared lock protocol. Lock namespace, unavailable lock, rejected lock, synchronous lock failure, and persistence failure regressions were added before the final full gate.
11. Fresh rereview storage failure: a seven-operation hostile storage matrix first reproduced `getItem` failures allowing stale writes from hydration, add, selection, quantity, reconciliation, and clearing. The read path now distinguishes unreadable storage from malformed readable data and fails closed before `setItem` or store mutation. All production cart callers were then updated to await or explicitly guard the asynchronous lock boundary.
12. Final rereview browser rejection: a blocked `sessionStorage` property first produced an unhandled promise rejection, left the matching request in place, and prevented rerender retry. The cleanup path now catches that failure, keeps the request available, permits one retry for new page data, and guards successful cleanup against duplicates.

## Verification evidence

- `npm test -- --coverage`
  - 73 test files passed
  - 1,272 tests passed
  - 100% statements, branches, functions, and lines across authored JavaScript
- `npm run check`
  - 0 errors and 0 warnings
- `npm run lint`
  - Prettier and ESLint passed
- `npm run build`
  - Production client and server bundles built successfully
- `git diff --check`
  - Passed
- Disposable PostgreSQL integration
  - Committed migrations applied to a fresh cluster
  - Matching capability returned one masked immutable receipt
  - Forged, cross-order, and exact-boundary expired capabilities returned no data
  - Twelve concurrent authorized reads returned the same receipt
  - Order, fulfillment, attempt, version, and audit state remained unchanged
- Installed Google Chrome visual and response validation
  - Desktop: 1440 by 900, no horizontal overflow
  - Mobile: 390 by 844, no horizontal overflow
  - Generic unauthorized recovery heading and both recovery actions were present
  - Response headers in Chrome matched no-store, noindex, and no-referrer policy
  - Fresh screenshots inspected at `/tmp/wu8-confirmation-desktop-rereview2.png` and `/tmp/wu8-confirmation-mobile-rereview2.png`
- Leak scans
  - No capability plaintext, capability hash field, secure confirmation cookie name, Stripe session query field, raw fixture email, or checkout request fixture appeared in the client build
  - No logging call appears in the confirmation or cleanup paths
  - No payment-state mutation statement appears in the confirmation repository
  - No forbidden long dash or middle-dot character appears in WU8 UI copy

The authorized paid and terminal layouts were exercised through component tests rather than by bypassing the capability boundary in a browser. The fresh-browser visual check intentionally covered the real unauthorized recovery path. No test-only confirmation bypass was added.

## Files in this work unit

- `src/lib/server/orders/confirmation.js`
- `src/lib/server/orders/confirmation.test.js`
- `src/lib/server/orders/confirmation.integration.test.js`
- `src/routes/books/order-confirmation/+page.server.js`
- `src/routes/books/order-confirmation/page.server.test.js`
- `src/routes/books/order-confirmation/+page.svelte`
- `src/routes/books/order-confirmation/page.test.js`
- `src/routes/books/order-confirmation/[orderReference]/+page.server.js`
- `src/routes/books/order-confirmation/[orderReference]/+page.svelte`
- `src/routes/books/order-confirmation/[orderReference]/page.test.js`
- `src/lib/books/cart-store.js`
- `src/lib/books/cart-store.test.js`
- `src/lib/books/checkout-request.js`
- `src/lib/books/checkout-request.test.js`
- `src/lib/server/config/environment.js`
- `src/lib/server/config/environment.test.js`
- `src/lib/server/books/stripe.js`
- `src/lib/server/books/stripe.test.js`
- `src/routes/api/book-checkout/+server.js`
- `src/routes/api/book-checkout/server.test.js`
- `src/routes/books/[teacherSlug]/[courseId]/+page.svelte`
- `src/routes/books/[teacherSlug]/[courseId]/page.test.js`
- `src/routes/books/+layout.svelte`
- `src/routes/books/layout.test.js`
- `src/routes/books/cart/+page.svelte`
- `src/routes/books/cart/page.test.js`
- `src/routes/books/checkout/+page.svelte`
- `src/routes/books/checkout/page.test.js`

## Review gate

The independent review findings about unlocked ordinary writes, unsafe storage-read fallback, and unhandled confirmation cleanup rejection were reproduced and resolved. WU8 is ready for a fresh independent review. It has not been committed or deployed.
