# Signed Stripe webhook reducer report

## Scope and outcome

Secure Work Unit 7 is implemented and review-ready. `/api/stripe/webhook` is an independently reachable, signed Stripe boundary that remains available while public Book Delivery is `coming-soon`. It reduces the exact release-one event allowlist into monotonic persisted payment state without creating fulfillment work.

This unit does not implement confirmation consumption, staff order UI or mutations, security-header integration, reconciliation, maintenance, deployment provisioning, or live provider smoke. Those remain owned by WU8, WU9, WU10, WU11A, and WU11.

## Raw request and signature boundary

- The route accepts only JSON media type with an optional UTF-8 charset. Declared and streamed bodies are capped at 65,536 bytes; streamed overflow is cancelled and the reader lock is always released.
- `Stripe-Signature` is required, rejects control characters, and is capped at 2,048 characters.
- The unchanged `Uint8Array` is passed to Stripe's official `constructEventAsync` with the validated `STRIPE_WEBHOOK_SECRET`. No decoding, JSON parsing, provider retrieval, database access, or event-data inspection occurs before official verification succeeds.
- A signed malformed JSON body is distinguished from an invalid signature only after verification. Crypto/client failures return retryable `503`, rather than being misclassified as attacker input.
- Verification failures use the default-deny security logger with only route, bounded reason, and status. The route never logs the body, signature, Stripe object, provider error, customer data, or database detail.
- Valid signed unknown and asynchronous event types are stored as `ignored_unsupported_type` and acknowledged with `2xx`. The exact handled allowlist is `checkout.session.completed`, `checkout.session.expired`, and `charge.refunded`.
- The production route reads and validates only `DATABASE_URL`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET`, deriving the exact `test` or `live` Stripe mode from the secret-key prefix. Missing unrelated application, Google, Better Auth, capability, rate-limit, cron, origin, checkout-host, or launch configuration cannot prevent a valid Stripe retry from reaching verification and reduction.
- There is no launch-state guard or generic rate limiter on the signed webhook retry path.

## Provider evidence

Provider retrieval is complete before the final reducer transaction begins.

- Completed Checkout retrieves the Session and PaymentIntent. It requires paid/complete payment mode, one card method, CAD, exact total, exact client reference, exact service/schema/order/attempt metadata, exact test/live mode and Session prefix, succeeded/fully received PaymentIntent, matching latest Charge, and a bounded receipt email equal to the Checkout email.
- Expiration retrieves the Session only. It requires expired/unpaid provider state and the same mode, identifier, metadata, client-reference, currency, total, card, and expiry bindings.
- Refund retrieves the Charge and PaymentIntent first, then performs a short read-only database preflight for the stored Session ID. That transaction closes before the Session is retrieved. The Charge must be paid, CAD, mode-correct, bound to the PaymentIntent, and report a positive internally consistent cumulative refund. The PaymentIntent must remain succeeded and bind the exact charge, amount, receipt email, and metadata. The stored Session is then retrieved and bound back to the same order, attempt, PaymentIntent, total, email, and signed event mode.
- A provider retrieval or database availability failure records nothing and returns retryable non-`2xx`. A well-formed provider mismatch is recorded transactionally with the bounded `rejected` disposition and acknowledged.

## Atomic reducer and idempotency

The final database operation is one short transaction:

1. Insert the Stripe event ID, type, mode, received timestamp, and provisional bounded disposition with `ON CONFLICT DO NOTHING`.
2. For an existing exact event ID, validate the already-processed type/mode/disposition and return `duplicate` without repeating state or audit effects.
3. For handled events, lock the exact checkout attempt and order with `FOR UPDATE` and revalidate every stored identifier, amount, status, version, timestamp, customer receipt email, and provider binding.
4. Apply the permitted compare-and-set transition to the attempt and order, append the non-PII audit record, and finalize the event disposition in the same transaction.

Any failed insert result, lock shape, state invariant, compare-and-set, audit write, event finalization, or reducer-result validation aborts the outer transaction. Real PostgreSQL tests prove that event, attempt, order, and audit changes roll back together and that concurrent delivery of one event creates exactly one effect and one audit row.

State handling is monotonic:

- Verified completion moves `pending` or a stale concurrent `cancelled` order to `paid`. Paid, partially refunded, refunded, expired, and failed orders record a stale no-op. Fulfillment is never updated.
- Verified expiration moves only `pending` to `expired` and applies the 90-day PII deadline. Under the row lock, an optional provider PaymentIntent must match any stored PaymentIntent, and an optional provider receipt email must match the persisted order email. Conflicts are recorded as rejected without overwriting state. Expiration never regresses paid or refunded state.
- Verified refund supports provider-proven refund-before-completion. It completes the attempt, stores the PaymentIntent and Charge IDs, and moves `pending`, `paid`, or `partially_refunded` to the increasing cumulative partial/full state.
- A positive amount below total becomes `partially_refunded`; exact total becomes `refunded`; equal cumulative amount is stale; decreasing, excessive, wrong-total, wrong-ID, wrong-email, and other mismatches are rejected without state change.
- Distinct events that describe an already-applied object state are recorded as bounded stale no-ops. The same event ID is acknowledged as a duplicate without a second audit or transition.

## Additive schema enforcement

The additive `0002_wu7_stripe_webhook_reducer.sql` migration adds:

- `orders.refunded_amount_cents`, constrained between zero and total and consistent with every payment state;
- `checkout_attempts.stripe_charge_id` with a unique index; and
- a strengthened attempt provider-state constraint requiring completed attempts to contain Session, PaymentIntent, Charge, expiry, ready, and terminal evidence while preventing Charge IDs in created, ready, expired, or failed states.

Disposable PostgreSQL tests apply all three committed migrations and cover valid/invalid pending, paid, partial, and full refund combinations, Charge uniqueness, complete rollback, and concurrent duplicate-event serialization.

## TDD and adversarial evidence

Production modules were introduced only after missing-module RED tests. Subsequent RED cases exposed and fixed the following boundary errors before final verification:

- accepting a refund Session whose live/test mode was inferred from an untrusted identifier instead of the signed descriptor;
- returning an endless `503` for a provider-proven refund whose stored PaymentIntent or Charge conflicted, rather than recording a bounded rejection;
- classifying Stripe client or crypto failures as invalid attacker signatures;
- allowing a test/live Session ID prefix mismatch despite a matching boolean `livemode`; and
- validating a malformed reducer result only after the database transaction callback returned, rather than forcing rollback inside the transaction;
- accepting expired Session evidence whose PaymentIntent or customer email conflicted with the locked attempt and order, which could overwrite the stored PaymentIntent; and
- making webhook availability depend on the monolithic application environment parser and therefore unrelated Google/Auth/Cron/capability/origin configuration.

The completed matrix covers raw-byte preservation, one-byte signature mutation, missing/empty/oversized signatures, media and content-length bounds, empty/non-byte/oversized streams, cancellation/logger failures, verified malformed JSON, invalid signed event structure, test/live mismatch, webhook-only environment availability and every missing/invalid required field, valid unsupported events, every provider object invariant, duplicate IDs, distinct stale events, expired PaymentIntent/email conflicts, refund-before-completion, partial/full/equal/decreasing/excess refunds, unknown or mismatched stored IDs, invalid database shapes, compare-and-set failures, audit failure, concurrent duplicate delivery, rollback, and absence of fulfillment side effects.

## Verification

- `npx vitest run --coverage --coverage.reporter=text --coverage.reportsDirectory=<isolated-temp-directory>`: 70 files and 1,185 tests passed. Statements, branches, functions, and lines are all 100%.
- Focused WU7 suite: 284 provider, reducer, narrow-environment, and route tests passed at 100% coverage.
- Disposable PostgreSQL migration suite: all 20 tests passed, including atomic rollback and concurrent duplicate-webhook reduction.
- `npm run check`: 0 errors and 0 warnings.
- `npm run lint`: all files formatted and ESLint clean.
- `npm run build`: passed. Existing non-blocking Better Auth optional instrumentation and optional `utf-8-validate` notices remain unchanged.
- `git diff --check`: passed.
- Production-source scans found no raw body/signature/provider/customer logging, no webhook rate-limit import or call, no fulfillment mutation, and no pre-verification parse.
- Built-output scans found none of the test webhook secret, test Stripe IDs, test customer email, or provider/database failure fixtures.

`npm audit --omit=dev` reports inherited low/moderate advisories in `cookie@0.6.0` through the current SvelteKit release and legacy `esbuild` through Drizzle Kit's loader. The proposed automated remediations are breaking version changes, so WU7 did not run `npm audit fix --force` or change dependencies outside its ownership.

## Shared-worktree preservation

The worktree already contained broad uncommitted redesign and secure WU1, WU2, WU3, WU4, WU5, WU6, and WU10 work. WU7 added its route, provider-evidence module, reducer, tests, additive migration, and the minimum schema/test extensions required for cumulative refunds and stored Charge identity. It did not rewrite prior migrations, revert unrelated files, implement later work units, change the closed public behavior, or create a commit.

## Deferred operational acceptance

Stripe receipt issuance still depends on the deployment work unit verifying Stripe business identity, branding, and receipt settings; WU6 supplies `payment_intent_data.receipt_email`, and WU7 validates the resulting receipt-email binding. Registration of test/live webhook endpoints, real signed provider delivery, replay in protected preview, production secrets, legal/tax approval, and launch-state change remain explicit WU11 acceptance gates.
