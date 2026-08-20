# Secure Book Delivery and Staff Operations Implementation Plan

**Source of truth:** `../specs/2026-08-13-secure-book-delivery-staff-portal-design.md` and `../../../club-book-delivery-threat-model.md`

**Outcome:** Finish and test the full Book Delivery frontend/backend behind a fail-closed public gate, with persistent Stripe orders, a server-only catalogue, and a secure staff portal available only to the verified Google identity `team@marihacks.com`.

## Work unit 1: dependencies, environment, and test seams

1. Pin compatible stable releases of Better Auth, Drizzle, Neon serverless, `ws`, and Drizzle Kit. Verify current official APIs before coding. Public WU1 alone owns coverage tooling.
2. Add typed server-only environment validation for canonical origin, separate runtime/migration database URLs, Better Auth secret/origin, Google credentials, Stripe key/webhook secret, launch state, independent rate-limit HMAC key, and rotating `CRON_SECRET`.
3. Missing or malformed launch state resolves to `coming-soon`; missing secrets never appear in responses or logs.
4. Add dependency-injected test seams for DB, Stripe, and authenticated locals. No production auth-bypass endpoint or environment switch.

## Work unit 2: schema and real transactions

Files: Drizzle schema, generated migrations, DB client, integration tests.

1. Test-first define Better Auth tables plus teachers, courses, bookstores, books, course_books, orders, order_lines, checkout_attempts, stripe_events, audit_log, and rate_limit_buckets.
2. After WU4 finalizes Better Auth configuration and generates its table/rate-limit models, add all application and Better Auth constraints: CAD currency, nonnegative cents, positive quantity, exact total equation, valid-state checks, unique public reference/capability hash/request ID/session/payment intent, foreign keys, indexes, timestamps, and version.
3. Make order lines immutable and audit rows append-only through runtime grants/DB enforcement.
4. Use `drizzle-orm/neon-serverless` with `@neondatabase/serverless` WebSocket Pool and Node `ws`. Each request/background operation creates a request-scoped pool, checks out one client, performs lock/read/write/audit/event work on that same transaction connection, releases in `finally`, then closes the request-scoped pool. Never reuse a pool across Vercel requests.
5. Prove commit, rollback, constraint failures, and concurrent duplicate handling against disposable Postgres/Neon, not only mocks.

## Work unit 3: server-only catalogue and staff CRUD

1. Move all sample catalogue data to test-only fixtures. Production repository returns verified DB records or empty state only.
2. Implement server-only repository queries for active teacher-course-bookstore-book records and canonical price/service-fee/tax calculations.
3. First implement only repository methods. After WU4 authentication is complete, implement authenticated staff list/create/edit/activate/deactivate flows with stable IDs, approved-hostname allowlists for retailer and cover URLs, cents validation, course-book ordering, optimistic version checks, and audit writes.
4. Never fetch bookstore or cover URLs on the server; render validated HTTPS URLs only to clients.
5. Test stale edits, validation preservation, deactivation confirmation, empty/no-result states, and no client import of fixtures/server modules.

## Work unit 4: Better Auth admission and authorization

1. Configure Better Auth 1.6 with only Google, database sessions capped at 8 hours, `disableIdTokenSignIn: true`, encrypted OAuth tokens, basic identity scopes, no offline access, no One Tap/password/magic-link/self-registration, and Better Auth's database-backed sign-in limiter (`rateLimit.storage = "database"`) with its own generated schema/model and fail-closed tests. Finalize and generate the schema contract before WU2 creates migrations, then complete hook and route integration after WU2.
2. Override Google `getUserInfo`: require stable `sub`, `email_verified === true`, and normalized exact `team@marihacks.com`; return `null` on any mismatch before user/session issuance. Use `mapProfileToUser` only for bounded mapping.
3. In `hooks.server.js`, call `auth.api.getSession`, populate locals, and then call `svelteKitHandler`.
4. Centralize `requireStaff()` and invoke it in `/staff/+layout.server.js` plus every protected load/action/API. Recheck provider, verified email, exact address, expiry, and session on every request.
5. Test approved mixed-case normalization, missing/unverified email, alias/lookalike/other account denial, forged/expired/revoked sessions, CSRF/origin enforcement, safe redirects, cookie flags, and no GET side effects.

## Work unit 5: fail-closed launch boundary

1. Add non-prerendered `/books/+layout.server.js` and a shared server guard. In coming-soon mode `/books` renders the notice and every nested server loader must either await `parent()` before repository access or call the guard itself; nested route data must never load before redirect.
2. Gate checkout before reading the body or touching rate limit, DB, or Stripe. Keep staff and signed Stripe webhook independently reachable.
3. Convert live catalogue loaders to server-only repositories. Root prerendering must not serialize live catalogue data.
4. Test missing/invalid/coming-soon/live states, direct nested URLs, endpoint call ordering, and built output.

## Work unit 6: guest order quote and crash-safe Checkout

1. Preserve guest name and email checkout, teacher-course book selection, quantities, retailer links, cart grouping, and one service fee from $5 to $7 per represented bookstore. The server reprices entirely from active database records.
2. Require exact canonical browser Origin, JSON content type, byte/schema/quantity bounds, launch-live state, and durable rate limits.
3. Require a bounded browser-generated random checkout request ID that is persisted across retries. Generate the 256-bit confirmation capability in checkout creation, canonicalize the request, generate its hash, and transactionally persist only the capability hash plus order, immutable lines, and checkout attempt before Stripe.
4. Same request ID plus same hash recovers the same attempt; same ID plus different hash returns 409.
5. Create card-only Stripe Checkout outside the transaction using a stable idempotency key, internal order UUID as client reference/metadata, configured `APP_ORIGIN`, and Stripe receipt email. Accept only `https://checkout.stripe.com` or the explicitly configured custom Stripe host.
6. Persist session ID, payment intent when available, expiry, and ready timestamp before returning the URL. On the successful API response, issue the plaintext capability as a Secure/HttpOnly/SameSite cookie scoped only to the confirmation path; WU8 consumes it. If persistence fails after Stripe succeeds, return 503 and reveal no URL or capability; retrying the same request ID replays Stripe, persists the same session, and may then issue the cookie. A new request ID is rejected until the earlier attempt is terminal.
7. Test every crash boundary, duplicate/concurrent request, forged client price, stale catalogue record, provider mismatch, and redirect-host rejection.

## Work unit 7: signed webhook reducer

1. Bound raw bytes before signature verification; use Stripe’s official verifier and never log payloads.
2. Exact handled allowlist: `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`. A validly signed unknown or asynchronous type receives a bounded `ignored_unsupported_type` disposition and 2xx acknowledgement because release one is card-only; signature, retrieval, or database failures follow their explicit error paths.
3. Retrieve provider objects outside the DB transaction and validate environment, stored IDs, metadata/service/schema, order/attempt, CAD, and total.
4. In one short transaction record event ID/type/disposition, lock the order/attempt, apply a monotonic conditional transition, and append audit history. Duplicate/stale valid events are bounded no-op 2xx responses; retrieval/DB failure commits nothing and returns non-2xx.
5. Completed becomes paid only for verified paid Session. Expired never regresses paid. Refund maps through stored PaymentIntent/Charge; increasing amount below total becomes partial, exact total becomes refunded, mismatch/excess is rejected.
6. Test invalid signature/body, duplicates with same and different event IDs, concurrency, out-of-order sequences, wrong livemode/currency/amount/session/metadata, refund-before-completed, rollback, and no fulfillment side effects.

## Work unit 8: confirmation capability and receipt UI

1. Replace Stripe session ID authorization/reference with a random 256-bit capability stored only as a hash and transported in a Secure/HttpOnly/SameSite cookie scoped to confirmation.
2. Load persisted order state only. Before webhook commit show processing; only persisted paid state clears cart and shows receipt/pickup details.
3. Mask email, display public reference, keep exact money lines/manual purchase note/Wayne’s Front Desk map, and expose minimal recovery state without capability.
4. Set no-store, noindex, no-referrer; never log query/capability/session IDs.
5. Test valid/invalid/expired capability, processing/paid/refund states, cart clearing, headers, and data minimization.

## Work unit 9: staff order operations

1. Build editorial, non-card-heavy staff sign-in, order ledger, bounded filters, order detail, bookstore-grouped purchase list, and audit history. WU3 alone owns catalogue navigation and editing.
2. Keep payment state provider-owned. Staff fulfillment transitions use row lock plus expected version and same-transaction audit: unstarted → purchasing → received → ready_for_pickup → picked_up.
3. Cancellation first expires or verifies already-expired Stripe Session outside DB, then conditionally updates only pending/unstarted; a concurrent paid transition wins. Refunds are initiated only in Stripe Dashboard and mirrored by verified webhook.
4. Use POST named actions, same-origin CSRF, no raw email in URLs/logs, bounded pagination/search, escaped rendering, and no `{@html}`.
5. Test authorization on every load/action, stale conflicts, audit rollback, empty/error/loading/success states, keyboard use, 44px targets, mobile labelled records, and no horizontal page scrolling.

## Work unit 10: durable controls and headers

1. Implement atomic application Postgres rate buckets with independent `RATE_LIMIT_HMAC_KEY`, versioned/domain-separated HMAC identifiers for trusted Vercel client address, normalized email, session, and action. Never store raw IP. Use them for checkout and staff mutations; Better Auth's separate database-backed limiter owns OAuth/sign-in. Fail closed when either applicable limiter DB is unavailable; exempt valid signed webhook retries.
2. Make SvelteKit `kit.csp` the sole CSP script/style owner with framework-compatible hashes/nonces. Use `vercel.json` only for non-conflicting baseline headers.
3. Apply route-specific private/no-store/noindex/no-referrer policies to staff, auth, checkout errors, webhook, and confirmation.
4. Test deployed header values, Google Maps frame allowance, framing denial, content sniffing, permissions policy, HSTS, trusted-address extraction/fallback, atomic limits, cleanup, and failure behavior.
5. Add a structured server logger with default-deny fields and explicit redaction of customer email, confirmation capabilities, cookies, OAuth/Stripe identifiers, secrets, provider payloads, and query strings. Emit bounded security event codes for authorization and webhook-verification failures without raw attacker input. Test prohibited values and nested error/cause serialization.

## Work unit 11: retention, operations, and artifact safety

1. Implement a protected, bounded, idempotent scheduled maintenance job for 90-day post-terminal PII anonymization and expired rate-bucket cleanup. Preserve non-PII accounting/audit facts, audit anonymization counts without identities, and test authorization, batch bounds, duplicate/concurrent runs, partial failure, retry, and paid/active-order exclusion. Document owner, scheduled invocation, backup/PITR, and incident procedure.
2. Commit `docs/book-delivery-deployment.md` with executable credential preflight; Neon provision/migration/seed/least-privilege role commands; fixed local, protected-staging, and production Google callbacks; one approved and one denied OAuth smoke; Stripe test/live webhook registration, signed replay, business identity and email-receipt configuration; Vercel production/preview/development environment-scope audit; `CRON_SECRET` route/schedule/rotation; production-only live secrets; preview deployment protection; smoke commands; rollback; key rotation; cleanup; and credential revocation. Production may switch to `live` only after documented human approvals for applicable legal/tax treatment, refund policy, Stripe business/receipt configuration, and Wayne's Front Desk pickup operations. Migrations run as an explicit controlled predeploy step, never app startup.
3. Scan production build for fixture imports/IDs, sample titles/teachers, placeholder strings, Drive folder ID/URL, temp paths, public env names, Stripe/Google/DB secret prefixes, and source maps containing server code. This is the sole scanner shared with Public WU9.

## Work unit 11A: protected checkout reconciliation

1. Add a Vercel Cron-compatible GET endpoint authenticated by exact `Authorization: Bearer ${CRON_SECRET}` and register it in `vercel.json`. This authenticated GET performs the scheduled job by design; all other GET routes remain side-effect-free. Bound each batch and make every reconciliation idempotent and auditable.
2. For attempts with a stored Session, retrieve Stripe outside the transaction and reconcile provider-expired sessions through the same monotonic reducer. For attempts with no Session one hour after creation, only after confirming there is no recoverable stored/provider session, atomically mark both the attempt and its order failed and set the order's terminal `pii_purge_after`; never regress paid or fulfilled orders.
3. In a short transaction lock the attempt/order, compare current state/version, write the bounded reconciliation record and audit row, and commit atomically. A concurrent webhook/provider-paid result wins.
4. Test unauthorized scheduling, duplicate runs, pagination, provider/DB failure retries, one-hour boundary, orphan recovery, concurrent webhook races, and paid precedence.

## Work unit 12: provider and end-to-end acceptance

1. Provision separate preview resources, run migrations, and validate real Neon transactions.
2. In Stripe test mode, complete Checkout, deliver a signed webhook, replay it, verify exactly one paid transition/receipt state, and test expiry/refund reconciliation.
3. Verify one real approved Google login and one real denied Google account, exact callbacks/origins, cookie flags, session expiry, and logout/revocation. Never weaken the allowlist to accommodate an alias.
4. Run full unit/100% authored-source coverage/check/lint/format/build/E2E/security/accessibility suites in live test mode and coming-soon production mode.
5. Have fresh security and fresh-user subagents test the staff/order flows and fix all findings. Do not call the backend complete until provider smoke tests and artifact scan pass.

## Execution and file ownership

Use the combined sequence and exclusive ownership rules in the public plan. Backend WU1 owns backend dependencies/env only; WU4 owns auth configuration/schema generation and later hooks/authorization; WU2 owns all schema/migrations/DB client after schema generation; WU3 repository phase owns catalogue server modules and its later UI phase alone owns `/staff/catalogue`; WU5 owns launch guards and nested/API gate wiring; WU10 rate buckets/logging are implemented before the endpoints and mutations they protect, with final header integration later; WU6 owns checkout creation and capability issuance; WU7 owns webhook; WU8 owns confirmation consumption; WU9 owns `/staff/orders`; WU11A owns only the reconciler endpoint/job; WU11 owns maintenance/runbooks/retention/artifact scanner.

Before editing, every unit records `git status --short` and the existing diff for each file it will touch. It integrates pre-existing edits incrementally and records its attributable post-edit delta. Ambiguous ownership stops that unit for a read-only audit or moves it to an isolated worktree; implementers never overwrite, normalize, or revert another agent's unexplained changes.
