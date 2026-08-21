# Book Delivery launch boundary report

## Scope

Secure work unit 5 adds the server-enforced Book Delivery launch boundary. It does not add durable order creation, webhook processing, or staff operations from later work units.

## Implemented behavior

- `BOOK_DELIVERY_LAUNCH_STATE` opens the service only for the exact value `live`. Missing, empty, malformed, and differently cased values resolve to `coming-soon`.
- `/books` is not prerendered. In the closed state it renders a short factual launch notice without a cart, course, teacher, book, price, or purchase action.
- Every nested `/books/*` request redirects to `/books` from the server layout before a child load can query a repository or provider.
- Child server loads for the teacher redirect, course detail, cart, checkout, and confirmation await the parent boundary before doing route work.
- `/api/book-checkout` checks launch state before origin checks, request body reads, catalogue access, order construction, environment lookup, or Stripe access. The closed response is a bounded `503` JSON error.
- The gate is scoped to `/books` and `/api/book-checkout`. It does not wrap `/staff`, authentication, or a future signed webhook route.
- The Book Delivery navigation and cart context mount only in live mode.
- Live cart and checkout pages reconcile saved selections against active catalogue IDs before calculating totals. They persist the repaired cart, keep valid lines, and announce when unavailable books were removed. An all-unavailable cart returns to the useful empty state and cannot submit checkout.

## Catalogue boundary

- Public catalogue and course detail data now come from the server-only database repository.
- Cart and checkout pages receive a bounded serializable catalogue projection from a server load. Client code no longer imports a static catalogue.
- Runtime catalogue construction requires an explicit database URL, an exact HTTPS hostname allowlist, and a validated tax rate in basis points. There is no permissive default.
- The homepage now reports Book Delivery as coming soon and contains no synthetic course or cover strip.
- The former production fixture moved to `src/test/fixtures/book-catalogue.js`. Production source has no fixture import or fallback.
- Generated fallback cover semantics use `Cover of [title]`. Production code contains no user-facing placeholder label.

## Test evidence

- Full suite: 59 files, 651 tests passed.
- Authored JavaScript coverage: 100 percent statements, branches, functions, and lines.
- Svelte check: zero errors and zero warnings.
- Prettier and ESLint: passed.
- Vite production build: passed.
- Git whitespace validation: passed.

The production preview returned:

- `/books`: `200` with the closed launch notice.
- `/books/cart`: `303` to `/books`.
- `/api/book-checkout`: `503` before parsing a deliberately invalid request body.
- `/staff/sign-in`: reached the independent authentication boundary and returned its expected unavailable response because the local preview had no credentials. It was not redirected by the Book Delivery gate.

## Artifact scan

The generated client and server output contains none of the test fixture titles, teachers, bookstores, course IDs, fixture paths, Drive folder identifiers, local temporary paths, reference-image paths, user-facing placeholder copy, source maps, or credential values.

The server build contains expected environment variable names and validation regular expressions. It contains no configured secret value, database URL, Google credential, Stripe key, or webhook secret.

## Pre-existing work preserved

This unit recorded the existing diff before editing route and Book Delivery files. It retained the prior public redesign, component polish, authentication, schema, transaction, and repository changes. No unrelated change was reverted or normalized.
