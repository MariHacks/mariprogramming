# Secure Book Delivery and staff portal design

## Purpose

Finish the Book Delivery service as a complete, testable system while keeping it publicly marked `Coming Soon` for the first production deployment. Add a staff operations portal for manual purchasing and pickup work. Only `team@marihacks.com` may sign in.

The portal manages Book Delivery orders and catalogue data. Fall 2026 interest-form responses remain in Google Forms and Sheets and are not copied into this system.

## Existing customer flow

The existing product contract remains binding:

- One catalogue entry per teacher and course.
- Students can include or exclude individual assigned books and change quantities.
- Each book can link to its bookstore listing.
- The cart appears only inside Book Delivery.
- The service fee is charged once per bookstore and remains within the configured $5 to $7 range.
- Guest checkout collects the pickup name and receipt email.
- Stripe hosts card collection and sends receipts.
- Purchasing happens manually after confirmed payment.
- Pickup is at Wayne's Front Desk at Marianopolis College.
- Pickup information appears in checkout and confirmation, not on course detail pages.

## Architecture

The SvelteKit application remains the only application server. Vercel runs the Node.js adapter. Stripe hosts payment collection. Neon Postgres stores operational records. Better Auth v1.6 handles Google OAuth through its first-class SvelteKit integration and database sessions. Session identifiers use Secure, HttpOnly cookies in production.

Google sign-in is only an identity proof. Better Auth enables only Google, sets `disableIdTokenSignIn: true`, and supplies a custom Google `getUserInfo` function. That function validates the trusted provider response for a stable `sub`, `email_verified === true`, and an email whose trimmed lowercase value exactly equals `team@marihacks.com`; it returns `null` on any mismatch. This admission check happens before user or session issuance. `mapProfileToUser` is used only for bounded field mapping, never authorization. OAuth token encryption is enabled. Every staff request still repeats the verified-email and exact-address check on the server. A Google Workspace domain check alone is not sufficient. There is no password login, One Tap, direct ID-token sign-in, staff self-registration, client-supplied role, or client-trusted authorization state.

The initial portal has one capability, staff operations, because one approved mailbox is supported. No unused application role field or hierarchy is introduced.

## Trust boundaries

- Browser to SvelteKit: untrusted form and route input over HTTPS. The server validates schema, origin, authorization, identifiers, quantities, and state transitions.
- SvelteKit to Google OAuth: authorization-code flow through Better Auth. Callback, state, PKCE, account, and session handling remain in the maintained library. The SvelteKit hook calls `auth.api.getSession`, populates server locals, then passes control to `svelteKitHandler`; session population is never assumed to happen automatically.
- SvelteKit to Stripe: secret-key server calls only. The browser receives only a hosted Checkout URL.
- Stripe to webhook endpoint: raw HTTPS body plus `Stripe-Signature`. The server verifies the endpoint secret before parsing business data.
- SvelteKit to Postgres: server-only connection string and parameterized queries through Drizzle.
- Staff browser to staff actions: authenticated session plus exact-email authorization on every server load and action.

## Data model

### `orders`

- `id`: random UUID, never an incrementing public identifier
- `customer_name`
- `customer_email`
- `public_reference`: unique random human-readable reference that is not a database or Stripe identifier
- `confirmation_token_hash` and `confirmation_expires_at`
- `currency`: fixed to `cad`
- `payment_status`
- `fulfillment_status`
- `version`
- `subtotal_cents`
- `service_fee_cents`
- `tax_cents`
- `total_cents`
- `created_at`
- `updated_at`
- `pii_purge_after`

### `order_lines`

Order lines are immutable purchase snapshots. They contain the order ID, kind, book or fee label, ISBN when present, bookstore identity, quantity, unit amount, and line amount. Later catalogue edits cannot change an existing order.

### `checkout_attempts`

Each payment attempt has its own random ID, order ID, client request fingerprint, stable Stripe idempotency key, Stripe Checkout Session ID, PaymentIntent ID when available, status, created timestamp, and updated timestamp. Session IDs and idempotency keys are unique. Retries do not overwrite earlier provider evidence.

### `stripe_events`

The Stripe event ID is the primary key. Each row stores the allowlisted event type, mode, received and processed timestamps, and bounded disposition. It does not store the full payload. Recording it inside the same transaction as the order update makes webhook processing idempotent.

### `audit_log`

Each operational event records a random UUID, order ID, actor kind, staff identity when applicable, action, previous state, next state, request or provider event ID, and timestamp. It covers order creation, payment events, every staff mutation, cancellations, refunds, and pickup. Audit rows are inserted in the same transaction as the change. Database permissions or a trigger deny application updates and deletes.

### Catalogue tables

Staff-managed `teachers`, `courses`, `bookstores`, `books`, and `course_books` records replace the fixture catalogue for live server loads. Records use random IDs, explicit active flags, bounded text fields, integer-cent prices, service fees limited to $5 through $7, and validated HTTPS retailer and cover URLs. Records used by an order are deactivated rather than deleted. Test fixtures live only in test modules and are never imported by production code.

No card number, CVC, billing address, session cookie, raw webhook secret, full Stripe payload, or unbounded staff note is stored. Better Auth OAuth tokens are encrypted at rest, request only basic identity scopes, and never request offline access.

## Order lifecycle

Payment and fulfillment use separate state machines.

Payment moves from `pending` to `paid`, `expired`, `failed`, or `cancelled`. Refunds are initiated only in the Stripe Dashboard by an authorized Stripe account operator. The staff portal contains no refund action. Verified provider refund events move `paid` to `partially_refunded` or `refunded`, and the portal only mirrors that provider state. Staff cannot mark an order paid or refunded. Staff may cancel only a pending order whose fulfillment remains `unstarted`. Cancellation first expires the active Stripe Checkout Session or verifies that it is already provider-expired, then uses a compare-and-set transaction that succeeds only if the order is still pending and unstarted. Failure to expire leaves the order pending and reports recovery guidance. Cancellation never issues a Stripe refund, and a concurrent or later provider-proven payment takes precedence over a stale cancellation attempt.

Fulfillment remains `unstarted` until payment is `paid`, then moves to `purchasing`, `received`, `ready_for_pickup`, and `picked_up`. Staff actions submit an intended next fulfillment state and expected version. The server locks the order, rejects invalid or stale transitions, and writes the event history in one transaction.

## Checkout and fulfillment

The checkout endpoint recalculates every amount from active server-side catalogue records. It creates the pending order, immutable lines, and checkout attempt before requesting a Stripe Checkout Session. Random order and attempt IDs are stored in Stripe metadata. A repeat of the same client request ID and fingerprint resolves the same attempt and Stripe idempotency result. Reusing the ID with different data is rejected. If creation fails before Stripe succeeds, the attempt records failure and a fresh client request ID may create a new order. An expired Session always requires a new order and attempt.

A protected scheduled reconciler closes abandoned states without trusting browser return visits. It retrieves attempts past their provider expiry, records an idempotent reconciliation operation, and marks only provider-confirmed expired sessions `expired`. Attempts with no provider Session one hour after creation become `failed`. Pending and failed orders never enter the active fulfillment queue; staff can find them only with an explicit payment filter. Expired, failed, and cancelled orders receive `pii_purge_after` and follow the same 90-day anonymization rule. A missing expiry webhook therefore cannot leave an actionable pending order indefinitely.

The webhook endpoint:

1. Reads the bounded raw request body.
2. Verifies `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET`.
3. Accepts only the required Checkout event types.
4. Retrieves or validates the associated Checkout Session server-side.
5. Checks the expected service metadata and stored order ID.
6. Reconciles totals and payment status.
7. Inserts the event ID and updates the order inside one transaction.
8. Returns success for already-processed events without repeating fulfillment.

Release one explicitly requests card payment. The exact event allowlist is `checkout.session.completed`, `checkout.session.expired`, and `charge.refunded`. Delayed payment methods are disabled, so asynchronous payment events are rejected as unsupported. A completed event transitions payment only when a server-retrieved Session is paid and its environment, stored session ID, order and attempt metadata, service identifier, CAD currency, and total match. A refund event must map through the stored PaymentIntent and charge, use CAD, and reconcile `amount_refunded` against the stored total. A positive amount below the total becomes `partially_refunded`; an amount equal to the total becomes `refunded`; an excessive or mismatched amount is rejected and logged without state change. Provider retrieval happens before the short database transaction. The transaction records the event disposition, conditionally changes state, and writes history. A second valid event for the same object state is a no-op success. Expiration and failure can never regress a paid order.

| Event                        | Provider retrieval and checks                                                                                      | Allowed source                             | Result                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkout.session.completed` | retrieve Session and PaymentIntent; require paid, matching stored Session, metadata, mode, CAD, and total          | `pending` or `cancelled`                   | `paid`; already paid or refunded is a recorded no-op                                                                                                            |
| `checkout.session.expired`   | retrieve Session; require matching stored Session, metadata, and expired provider state                            | `pending`                                  | `expired`; any paid or refunded state is a recorded stale no-op                                                                                                 |
| `charge.refunded`            | retrieve Charge and PaymentIntent; require matching stored PaymentIntent, CAD, and nondecreasing `amount_refunded` | `pending`, `paid`, or `partially_refunded` | provider-proven paid amount plus positive refund below total becomes `partially_refunded`; exact total becomes `refunded`; duplicate amount is a recorded no-op |

Unknown event types receive a bounded ignored disposition. Retrieval or database failure returns non-2xx and commits neither event nor state. Every duplicate, stale, invalid, or applied event receives one bounded disposition with no raw payload.

The browser supplies a bounded random checkout request ID. The server stores `(request ID, canonical request hash)` with the order and attempt before Stripe. Reusing the ID with different data returns 409. Reusing it with the same data recovers the same attempt. Stripe receives the attempt's stable idempotency key, the order UUID as `client_reference_id`, and bounded order and attempt metadata. Return URLs use required `APP_ORIGIN`, never a request Host. Returned payment URLs must use `checkout.stripe.com` or an explicitly configured Stripe custom domain. If Stripe succeeds but persisting the Session ID fails, the server returns 503 and does not disclose or expire the Session. A retry with the same request ID replays Stripe's original result, persists that same Session, and returns it. A new request ID can create a new order only after the earlier attempt is provider-confirmed terminal.

The confirmation page uses a random guest access token whose hash is stored. It reads the persisted order and webhook-updated payment state. It may show a bounded processing state while the webhook arrives but cannot create or advance an operational order. A Stripe session ID alone never authorizes customer or order disclosure.

## Staff portal experience

### Sign-in

`/staff/sign-in` contains one `Continue with Google` action and a short statement that access is restricted. OAuth progress disables repeat initiation and announces that Google is opening. The authentication hook decides verified email and exact address before issuing a session. An unverified identity or any identity other than `team@marihacks.com` receives a generic access-denied response, one safe retry action, one exit action, and no session. Expired sessions redirect back with a short reauthentication message.

### Order index

`/staff` remains available while the public service is `Coming Soon`. It is a flat operations ledger, not a dashboard-card grid. It provides payment and fulfillment filters, a search field for order reference or customer email, an order count, and ruled rows with order reference, masked customer email, amount, age, and status. Results are newest first, paginate in bounded pages of 25, and display Toronto-local dates. Age means time since order creation. Empty, no-results, unavailable, stale-update, and mutation-failure states explain the next recovery action.

### Order detail

`/staff/orders/[orderId]` shows the receipt snapshot, bookstore groups, customer pickup details, payment identifiers suitable for Stripe lookup, complete operational history, and the one valid next action. A cancellation confirmation states that it does not issue a Stripe refund. The responsive layout preserves labels and never requires horizontal scrolling.

### Catalogue

`/staff/catalogue` manages teachers, courses, bookstores, books, and course assignments in flat ruled tables. Staff can add, edit, activate, and deactivate records. The interface validates required relationships, integer-cent money values, the $5 through $7 bookstore fee range, ISBN shape when present, and HTTPS retailer and cover URLs. Every mutation is authorized on the server and audited. The first release accepts hosted HTTPS cover URLs and does not accept file uploads. It includes loading, empty, no-result, unavailable, inline validation, save-success, stale-edit, and deactivation-confirmation states. Errors preserve entered data and move focus to a useful summary or field.

Every staff surface works without horizontal page scrolling at 320, 390, 768, 1024, and 1440 pixels. Wide tables remain semantic tables; narrow layouts become labelled records rather than compressed tables. Filters and catalogue editing are keyboard complete. Status never relies on color alone. Field errors are associated, save and mutation states are announced, forced-color focus remains visible, and interactive targets are at least 44 pixels.

## Security controls

- Exact-email authorization on every staff server load, action, and API route.
- Better Auth state, callback, PKCE, account, and database-session handling. Sign-in accepts only a Google subject with verified email and exact normalized address. Sessions last at most eight hours. Session identifiers stay in Secure, HttpOnly, SameSite=Lax cookies in production and never enter Web Storage. A centralized `requireStaff` repeats the verified-email and exact-address checks in every staff load, action, and endpoint.
- Same-origin checks for state-changing browser requests. SvelteKit's CSRF origin checking remains enabled.
- Strict allowlists for Stripe and OAuth redirects. No arbitrary `next` URL is accepted.
- Bounded JSON and form bodies with schema validation and unknown-field rejection.
- Parameterized database access and random resource identifiers.
- Durable Postgres rate buckets protect checkout and staff mutations. Checkout permits 10 attempts per normalized-email HMAC per 15 minutes and a coarse 60 per client-address HMAC per hour. Staff permits 60 mutations per authorized session per minute. Better Auth uses its database-backed limiter for sign-in. Fixed active auth paths have separate buckets, while every unmatched path for one client shares one stricter fallback bucket. Limiters return 429 with retry guidance and fail closed when unavailable. Valid signed Stripe webhooks are not placed behind a generic quota.
- SvelteKit `kit.csp` is the sole CSP owner and supplies framework-aware script and style hashes or nonces compatible with hydration. The policy includes `frame-ancestors 'none'` and only the sources required by SvelteKit, Google OAuth navigation, Stripe redirects, self-hosted fonts, and the Marianopolis map. It does not use broad `unsafe-eval`.
- `vercel.json` supplies only nonconflicting baseline headers such as `X-Content-Type-Options: nosniff`, permissions policy, and defense-in-depth framing protection. Hooks and server responses own route-specific `Cache-Control: no-store`, `X-Robots-Tag: noindex`, and confirmation `Referrer-Policy: no-referrer`. Deployed header tests verify the combined result. Confirmation masks the receipt email and never logs its guest token or query string.
- Secrets exist only in private Vercel environment variables. Logs redact customer email, tokens, cookies, secrets, and raw provider payloads.
- Audit records cover every staff mutation. Failed authorization and webhook verification events emit bounded security logs without sensitive payloads.
- Catalogue retailer and cover URLs require HTTPS and an approved hostname. They are browser navigation or image sources only. The application server never fetches them, preventing catalogue-driven SSRF.
- Customer name and email are anonymized 90 days after `picked_up`, cancellation, expiration, or final refund. Financial totals and non-PII operational history remain. A scheduled protected maintenance task performs bounded batches and records anonymization without copying PII into its audit context.

## Required environment

- `BOOK_DELIVERY_LAUNCH_STATE`
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `APP_ORIGIN`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RATE_LIMIT_HMAC_KEY`

Production uses `BOOK_DELIVERY_LAUNCH_STATE=coming-soon`. Preview and test environments may use `live` with Stripe test credentials.

The flag is server-only and defaults closed. A non-prerendered `src/routes/books/+layout.server.js` resolves the launch state before operational route data. In `coming-soon`, `/books` renders only the launch notice and nested customer routes redirect before loading data. The checkout API checks the same helper before reading a body or contacting Postgres or Stripe. `/staff` and `/api/stripe/webhook` remain available so setup and delayed provider events can be handled. The current sample catalogue moves to test-only fixtures; production uses a server-only database repository and may be empty.

Neon access uses `drizzle-orm/neon-serverless` with an `@neondatabase/serverless` WebSocket Pool and Node `ws`, supporting interactive transactions and row locks. Each Vercel request or background operation creates its pool or client, uses one checked-out connection for the complete transaction, releases the client in `finally`, and closes the request-scoped pool before returning. Pools and clients are never reused across serverless requests. Every lock, read, update, event insert, and audit insert for an operation runs on the same transaction connection. Runtime and migration credentials have separate least-privilege grants. The schema includes database constraints for nonnegative amounts, positive quantities, CAD currency, allowed states, unique attempt, session, and intent identifiers, foreign keys, indexes, timestamps, and optimistic versions. Committed migrations run through a controlled predeploy step with a separate migration credential, never automatically inside a Vercel function. Production stays `Coming Soon` until migration and smoke checks pass.

Vercel Firewall adds coarse public abuse protection without replacing the database rate contract. A dedicated, rotation-versioned `RATE_LIMIT_HMAC_KEY`, never the auth secret, derives domain-separated email, client-address, and session bucket keys. Client address comes only from Vercel's trusted platform header in production; untrusted forwarding headers are ignored, and a missing trusted value uses the stricter anonymous bucket. Atomic Postgres upserts enforce windows and expiry. No limiter stores raw IP or email values. Rate-bucket cleanup is bounded and covered by the protected maintenance task.

## Failure behavior

- Missing database, OAuth, or Stripe configuration produces a generic unavailable state and never falls back to insecure access.
- A forbidden Google account is denied without revealing the allowlist through provider callbacks or logs. The sign-in page may state the approved team address because the user explicitly requested that address as the sole account.
- Invalid staff actions return a useful message and leave order state unchanged.
- Duplicate or out-of-order Stripe events are safe.
- Database errors never produce a successful staff mutation or paid order state.

## Testing

- Unit tests cover verified exact-email authorization, session absence, random IDs, schemas, amount reconciliation, separate payment and fulfillment transitions, catalogue validation, checkout retries, guest token hashing, and redaction.
- Endpoint tests cover cross-origin rejection, body limits, webhook signature failure, duplicate events, out-of-order events, unknown orders, wrong service metadata, database failure, and successful payment.
- Component tests cover sign-in, empty ledger, filters, search, order detail, valid transitions, catalogue editing, error recovery, keyboard use, and accessible names.
- End-to-end tests run Book Delivery in `live` mode with Stripe test doubles and run the production gate in `coming-soon` mode.
- A fresh user navigates the customer flow and a fresh staff reviewer navigates sign-in denial, empty orders, paid order processing, and pickup completion.
- A fixed preview environment uses Neon and Stripe test mode for one real provider-backed order. A signed Stripe test webhook must move the order to paid, a replay must remain idempotent, and the staff flow must complete pickup. Mocked tests remain required for deterministic failure coverage.
- The fixed preview receives one real approved Google sign-in and one real denied Google sign-in. Acceptance verifies the exact callback and origin, Secure and HttpOnly SameSite cookie behavior, server-side session authorization, sign-out, and expiry or forced revocation.
- Database integration tests run committed migrations against disposable Postgres and prove constraints, transaction rollback, duplicate-webhook races, append-only history, rate limits, and PII anonymization.
- The inherited baseline is repaired first. Unit tests, Svelte checks, lint, build warnings, and browser tests must be green before feature failures are evaluated. Vitest coverage is configured with the matching v8 provider and enforces the repository's 100 percent authored-source thresholds in CI.

## Acceptance criteria

- Only a verified Google identity whose normalized email exactly equals `team@marihacks.com` can receive a staff session.
- No public route or client state can mark an order paid.
- Every stored paid order comes from a verified, idempotently processed Stripe event.
- Staff can move a paid order through manual purchasing and pickup using only valid transitions.
- Every staff mutation creates an audit record.
- Staff can maintain every teacher, course, bookstore, book, assignment, retailer link, cover link, price, and service fee used by live checkout.
- Production exposes a Book Delivery `Coming Soon` page and blocks nested customer checkout routes and checkout API access.
- Test configuration proves the complete customer and staff flows work end to end.
- No secrets, card data, placeholder course records, or private Drive URLs appear in the production bundle.
- `docs/book-delivery-deployment.md` provides executable credential preflight, Google callback setup, Neon migration and empty-production initialization, Stripe webhook registration and replay, Vercel environment scoping, production and preview smoke commands, rollback, test-data cleanup, and credential revocation steps.
- The production artifact scan runs after `npm run build` and fails on imports from `tests/fixtures`, sample teacher or course identifiers, `Cover placeholder`, `placeholder`, `drive.google.com`, the supplied Drive folder ID, temporary asset paths, private environment names in client chunks, and known secret prefixes.
