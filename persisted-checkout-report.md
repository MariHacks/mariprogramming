# Persisted guest checkout report

## Scope and outcome

Secure Work Unit 6 is implemented and review-ready. The checkout boundary now creates one durable, server-priced guest order before contacting Stripe, recovers the same provider attempt after crashes or lost responses, and reveals neither the redirect URL nor the confirmation capability until Stripe readiness is committed.

The public production behavior remains closed unless `BOOK_DELIVERY_LAUNCH_STATE` is exactly `live`. This work does not implement webhook reduction, confirmation consumption, staff order operations, reconciliation, retention, deployment headers, or production provider smoke tests; those remain with WU7, WU8, WU9, WU10, WU11A, and WU11.

## Request and abuse boundary

- The launch gate executes first. A closed request returns `503` without reading the body or loading runtime configuration, rate limits, catalogue data, PostgreSQL, Stripe, or cookies.
- A live request requires an exact `Origin` equal to the validated canonical `APP_ORIGIN`. Missing, `null`, cross-scheme, cross-port, path-bearing, case-normalized, and lookalike values fail before body access.
- Only `application/json` with an optional UTF-8 charset is accepted. Declared and streamed bodies are capped at 16,384 bytes; streamed overflow is cancelled, UTF-8 decoding is fatal, and the JSON shape rejects unknown fields.
- Guest name and email are normalized and bounded. The request accepts 1 to 25 selected books, quantities from 1 to 10, no duplicate teacher-course or course-book entries, and at most 99 total copies.
- Every browser request carries `ckr1_` plus 32 WebCrypto random bytes encoded as 43 base64url characters. The browser stores only strict `{ "v": 1, "id": "..." }` retry state in session storage.
- The checkout page also retains that ID in page memory after generation. If session storage is blocked or throws, retrying the locked draft during the same page lifetime still reaches the identical server attempt instead of creating a conflicting ID.
- Both durable rate buckets are consumed in their own committing transaction before order creation: normalized email permits 10 attempts per 15 minutes and trusted Vercel client address permits 60 per hour. Failure or malformed limiter state fails closed; a denial returns the maximum applicable bounded `Retry-After` value.
- The canonical request fingerprint excludes the browser request ID and is a domain-separated HMAC over normalized contact and sorted course/book selections. Stored fingerprints are therefore not an offline name/email dictionary.

## Server pricing and durable reservation

- Cart identity is the composite `(courseId, bookId)`, so one book assigned to multiple courses remains unambiguous in the browser, server request, immutable snapshots, and later staff views.
- Every selected teacher-course group is quoted through the active catalogue repository on the same outer PostgreSQL transaction. Catalogue rows stay locked through persistence.
- The server ignores browser titles, prices, fees, tax, totals, return URLs, metadata, and retailer facts. It derives them from active database assignments.
- Multi-course quoting deduplicates one service fee from $5 to $7 per represented bookstore across the complete order, then calculates tax once.
- A valid zero-priced book remains representable when another persisted line makes the order payable. Stripe receives the zero-cent line unchanged, while quantities and the complete order total remain strictly positive and all line/total equations remain enforced.
- Before Stripe, one transaction acquires request-ID and request-fingerprint advisory locks, resolves an existing request, or inserts the order, deterministic immutable lines, checkout attempt, and creation audit atomically.
- Same request ID plus the same fingerprint loads the immutable snapshot without repricing. Same request ID plus a different fingerprint returns `409`. A partial unique index prevents another request ID from creating the same nonterminal intent concurrently.
- Persisted lines are always projected in a deterministic semantic order, so first-call and retry Stripe parameters are byte-equivalent.

## Crash-safe confirmation capability

The approved hash-only storage rule conflicts with generating a fresh unrecoverable random plaintext after the order transaction. WU6 resolves that without weakening the capability:

- `BOOK_CHECKOUT_CAPABILITY_KEY` is a dedicated secret of at least 256 bits and must differ from Better Auth, rate-limit, cron, Stripe API, and Stripe webhook secrets.
- The server derives 32 pseudorandom bytes with a domain-separated HMAC-SHA256 PRF over the random order UUID and random attempt UUID.
- PostgreSQL stores only a separately domain-separated SHA-256 hash. The plaintext exists only in server memory and, after readiness commits, the confirmation cookie.
- A retry after a committed response is lost rederives the identical 256-bit capability and verifies it against the stored hash. Concurrent successful retries therefore cannot issue mutually invalid cookies.
- The success cookie is `__Secure-mpc_book_confirmation`, with `Secure`, `HttpOnly`, `SameSite=Lax`, no `Domain`, and `Path=/books/order-confirmation`. Its lifetime is bounded by the persisted capability expiry.
- The capability is absent from JSON, URLs, Stripe metadata, browser storage, database values, and audit state.

## Stripe contract and recovery

- Stripe is contacted only after the reservation transaction commits and never from inside a database transaction.
- Checkout is hosted, payment mode, CAD, and explicitly card-only. Stripe receives the immutable persisted lines, one tax line when needed, guest email for Checkout, and `payment_intent_data.receipt_email` for receipts.
- Session and PaymentIntent metadata contain only the service/schema marker, internal order UUID, and checkout-attempt UUID. They contain no guest PII, browser request ID, capability, public reference, or rate identifier.
- Success and cancel URLs come only from canonical `APP_ORIGIN` and contain no query string, fragment, Stripe Session ID, order ID, request ID, or capability.
- The provider call uses the persisted `mpc-book-checkout-v1:<attempt UUID>` key in Stripe SDK request options. Retries reconstruct identical parameters from persisted snapshots.
- Before persistence or return, WU6 validates the Checkout Session object, test/live ID and mode, hosted UI mode, open/unpaid state, CAD total, client reference, exact metadata, email, card-only method, return URLs, creation/expiry interval, optional PaymentIntent ID, and redirect URL.
- Redirects accept only credential-free HTTPS on the exact `checkout.stripe.com` hostname or the exact validated configured custom Stripe hostname, with no explicit port. Suffix, subdomain, IP, IDN, malformed, overlong, userinfo, and HTTP forms are rejected.
- A second short transaction compare-and-sets Session ID, optional PaymentIntent ID, Stripe expiry, ready timestamp, status, version, and audit history. Exact replay is a no-op; conflicting provider facts fail closed.
- A ready retry retrieves the persisted Session ID and revalidates it. It does not create a second Session.
- If Stripe succeeds but persistence fails, the response is `503` with no URL and no cookie. The same browser request ID reuses the same persisted idempotency key, receives the original Stripe result, and retries persistence. Created attempts older than the conservative 23-hour replay window are not replayed.
- A canonical/configuration failure proven to occur before Stripe is contacted atomically marks the attempt and order failed, applies the retention deadline, and appends a non-PII audit event. Transport errors, provider errors, and invalid provider results remain nonterminal because Stripe may already have created the Session.

## Database enforcement

The WU6 migration adds:

- one checkout attempt per order;
- one active `created` or `ready` attempt per canonical request fingerprint; and
- provider-state consistency checks for `created`, `ready`, `completed`, `expired`, and `failed` attempts.

The existing constraints continue to enforce unique request IDs, public references, capability hashes, Stripe Session IDs, PaymentIntent IDs, exact CAD totals, immutable order lines, append-only audit rows, and restrictive foreign keys.

Disposable PostgreSQL tests apply every committed migration and cover provider-state constraints, duplicate request/fingerprint races, transaction rollback, immutable line and audit enforcement, and concurrent uniqueness behavior.

## TDD and adversarial evidence

The implementation was driven through failing boundary tests before production code. The RED cases included missing request-ID storage, composite cart ambiguity, multi-course fee duplication, absent durable reservation, same-ID replay conflicts, active-fingerprint races, unrecoverable hash-only capabilities, Stripe parameter drift, permissive redirect hosts, provider mismatches, premature URL/cookie exposure, and post-provider persistence failure.

The final regression matrix covers:

- closed-gate and exact dependency ordering;
- media type, byte, UTF-8, JSON, field, UUID, name, email, item, quantity, and aggregate bounds;
- durable email/address limits and fail-closed database results;
- stale/inactive catalogue selections and server repricing;
- same ID/same intent, same ID/different intent, different ID/same active intent, and concurrent duplicates;
- rollback before reservation commit, crash before Stripe, ambiguous provider failure, provider success before readiness commit, readiness commit before response, and lost response recovery;
- deterministic capability recovery and hash-only storage;
- exact Stripe parameters, idempotency, metadata, receipt email, return URLs, provider invariants, and redirect host policy; and
- browser retry/reload/double-submit behavior, strict request storage, fixed error copy, and redirect validation.

Four independent read-only audits covered the endpoint/client boundary, Stripe integration, schema/persistence, and security model before implementation. All four returned final WU6 PASS verdicts after the zero-price and definitive pre-provider failure repairs. They identified browser request-ID retirement and concurrent-order confirmation routing as WU8 confirmation-consumption handoffs rather than changes to WU6's fixed cookie/path/no-query contract.

## Verification

- `npx vitest run --coverage`: 67 test files and 984 tests passed. Statements, branches, functions, and lines are all 100%.
- The full suite includes disposable PostgreSQL migration and rate-limit integration tests; the WU6 migration/concurrency suite passed all 17 tests.
- `npm run check`: 0 errors and 0 warnings.
- `npm run lint`: passed with all files formatted and ESLint clean.
- `npm run build`: passed. Existing non-blocking Better Auth optional instrumentation and optional `utf-8-validate` notices remain unchanged.
- `git diff --check`: passed.
- Production-source scans found no `CHECKOUT_SESSION_ID`, `?session_id`, capability/query leak, or browser persistence of contact/provider/capability data.

`npm audit --omit=dev` reports inherited low/moderate advisories in `cookie@0.6.0` through the current SvelteKit release and legacy `esbuild@0.18.20` through Drizzle Kit's loader. The proposed automated fixes are breaking dependency changes, so WU6 did not run `npm audit fix --force` or change dependencies outside its ownership. Cookie names and attributes in this boundary are fixed server constants rather than attacker-controlled values.

## Shared-worktree preservation

The worktree already contained broad uncommitted public redesign work and secure changes from WU1 through WU5 and WU10. Those changes included overlapping environment, schema, Stripe, checkout endpoint, cart, and Book Delivery UI files. WU6 integrated incrementally, retained the launch guard, catalogue repository, transaction, rate-limit, visual, and accessibility contracts, and did not revert or normalize unrelated work. No commit was created.

## Deferred operational acceptance

WU6 supplies `payment_intent_data.receipt_email`, but live email delivery still requires the WU11 deployment runbook's Stripe business identity, branding, and receipt-setting verification. Provider test/live smoke, signed webhook reduction, confirmation consumption/clearing, expired-attempt reconciliation, legal/tax approval, pickup operations approval, secrets provisioning, and production launch remain explicit later acceptance gates.
