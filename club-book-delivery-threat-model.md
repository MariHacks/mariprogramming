# Book Delivery threat model

## Executive summary

The main risks are false payment state, unauthorized staff access, customer-data exposure, and an accidental public launch with test data. The repository now has the core controls for those risks: server-side repricing, durable checkout attempts, signed and idempotent Stripe webhooks, exact Google identity authorization, monotonic order transitions, append-only audit history, a fail-closed launch gate, bounded recovery, retention cleanup, and a production artifact scanner.

Production still stays at `coming-soon` until the provider, database recovery, legal, tax, refund, catalogue, and Wayne's Front Desk checks in the deployment runbook are approved. The remaining risk is operational, not a reason to weaken a control.

## Scope and assumptions

- In scope: `/books`, `/api/book-checkout`, `/api/stripe/webhook`, `/api/cron/book-delivery`, `/staff`, Better Auth, Neon Postgres, Stripe Checkout, Vercel configuration, logs, and production artifacts.
- The public programming club site is available while dedicated Book Delivery routes are closed.
- Preview and local acceptance may use `live` only with isolated test providers and a protected deployment.
- Only the verified Google identity `team@marihacks.com` may receive a staff session.
- Interest-form responses stay in Google Forms and Sheets. They do not enter this database.
- Card checkout is the only payment method in this release. Purchasing and pickup are manual.

## Trust boundaries and data flow

1. Student browser -> public application: book IDs, quantities, name, email, origin, and a random checkout request ID are untrusted.
2. Application -> Stripe: the server creates a hosted Checkout Session from a persisted, server-priced order.
3. Stripe -> webhook: the raw body and signature cross an unauthenticated network boundary before verification.
4. Vercel Cron -> scheduled endpoint: an authenticated GET is allowed only with the exact Bearer `CRON_SECRET`.
5. Staff browser -> Google -> Better Auth: Google establishes identity, then the application independently enforces verified email, stable provider subject, and exact account authorization.
6. Application -> Neon: short transactions lock rows, compare versions, change state, and write audit history.
7. Application -> external bookstore and map sites: configured HTTPS URLs are browser navigation or frames. The server does not fetch bookstore content.

## Protected assets

| Asset                                                                    | Security goal                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------- |
| Stripe, Google, database, cron, auth, rate-limit, and capability secrets | Confidentiality and rotation                            |
| Payment and refund state                                                 | Provider-backed integrity                               |
| Fulfillment state                                                        | Ordered, audited integrity                              |
| Customer name, email, and book choices                                   | Minimal disclosure and timed retention                  |
| Staff session                                                            | Exact identity, short lifetime, revocation              |
| Confirmation capability                                                  | Unpredictability, path scoping, expiry, one-way storage |
| Order lines and audit history                                            | Immutability and finance traceability                   |
| Public launch state and catalogue                                        | Fail-closed availability and authenticity               |

## Attacker capabilities

- Send arbitrary HTTP methods, headers, bodies, cookies, route IDs, and repeated requests.
- Change browser cart storage, prices, totals, and return URLs.
- Replay a previously observed provider event or attempt out-of-order delivery.
- Complete Google OAuth with an account other than the approved account.
- Use a stolen but not yet revoked staff session.
- Race checkout, webhook, staff, and scheduled operations.
- Follow configured external links and supply malicious content at an approved host after configuration error or host compromise.

The attacker cannot forge a valid Stripe signature, retrieve server-only secrets from a correct deployment, guess a fresh 256-bit confirmation capability, or bypass database constraints without another vulnerability.

## Abuse paths and controls

| ID     | Abuse path                                                                                  | Impact                                          | Current controls                                                                                                                                                                                                | Residual action                                                            |
| ------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| TM-001 | Submit altered prices, fees, taxes, books, or quantities                                    | Underpayment or invalid purchase                | Bounded schema, canonical Origin, durable rate limit, active catalogue lookup, server repricing, immutable order snapshot                                                                                       | Monitor bounded validation failures without payloads                       |
| TM-002 | Treat a Stripe return page or Session ID as proof of payment                                | Books purchased without settled funds           | Confirmation reads persisted state only; payment changes require signed webhook or strict provider retrieval                                                                                                    | Complete live provider smoke before launch                                 |
| TM-003 | Forge, replay, or reorder Stripe events                                                     | False or repeated payment state                 | Raw-body bound, official signature verifier, exact type allowlist, provider retrieval, event uniqueness, row locks, monotonic reducer, same-transaction audit                                                   | Alert on bounded verification and rejected-evidence codes                  |
| TM-004 | Sign in with another Google account or a forged local session                               | Customer-data exposure and order tampering      | Google-only flow, verified email, stable subject, exact normalized account, database sessions under eight hours, server authorization on every protected load and action                                        | Test one approved and one denied real account in each provider environment |
| TM-005 | Change an order ID or submit a stale staff form                                             | Cross-order access or invalid fulfillment       | UUID validation, authorized repository functions, expected version, explicit transition table, row lock, audit in the same transaction                                                                          | Review repeated conflict codes and revoke suspicious sessions              |
| TM-006 | Cancel while payment completes or expire a paid order                                       | Paid-state regression                           | Stripe expiry checked outside the transaction; conditional pending and unstarted update; webhook and reconciler recheck locked state; paid state is never downgraded                                            | Keep webhook and scheduled recovery active during rollback                 |
| TM-007 | Leak cookies, email, capabilities, provider payloads, or secrets through logs and responses | Account takeover or privacy harm                | HttpOnly cookies, hashed capability, no query capability, default-deny structured logger, bounded errors, no-store, noindex, no-referrer, SvelteKit CSP, frame denial                                           | Keep log destinations and access retention under operator review           |
| TM-008 | Flood endpoints or send oversized input                                                     | Cost or availability loss                       | Body and field bounds, one atomic HMAC-keyed durable limiter for auth, checkout, and staff traffic, Vercel-only trusted client header, bounded pages and jobs, signed webhook exemption only after verification | Add provider and database alerts before public launch                      |
| TM-009 | Poison origins, redirects, retailer URLs, or cover URLs                                     | Phishing, callback confusion, or unsafe content | Exact application origin, fixed OAuth callbacks, strict Stripe checkout host, approved HTTPS catalogue hostnames, no server-side URL fetch                                                                      | Review approved hostname ownership before catalogue activation             |
| TM-010 | Ship fixture data, local paths, credentials, source maps, or an open launch flag            | Misleading public service or secret exposure    | Server-only catalogue, test-only fixtures, closed-by-default launch state, non-prerendered Book Delivery boundary, production artifact scanner                                                                  | Run `npm run verify:release` on the exact release artifact                 |
| TM-011 | Stripe succeeds before Session persistence or an attempt is abandoned                       | Orphan payment or duplicate order               | Attempt and capability hash persist before Stripe, stable idempotency key, one active attempt, retry recovery, signed webhook metadata, hourly bounded reconciler                                               | Alert on repeated scheduled 503 and unresolved attempt backlog             |
| TM-012 | Steal or reuse an order confirmation capability                                             | Customer order disclosure                       | Random 256-bit value, hash-only storage, Secure HttpOnly SameSite cookie scoped to confirmation, expiry, masked email, timed purge                                                                              | Clear affected capability hashes during an incident                        |
| TM-013 | Put production credentials in an unprotected Preview                                        | Broad provider or data compromise               | Narrow server-only environment readers, documented scope matrix, isolated staging requirement, deployment protection, client artifact scan                                                                      | Human Vercel scope audit remains a launch gate                             |
| TM-014 | Retain personal data indefinitely or purge active finance records                           | Privacy harm or lost operational evidence       | Indexed purge date, eligible terminal states only, 90-day job, row lock, version check, capability invalidation, maintenance audit, finance and audit facts retained                                            | Document Neon backup retention and test restore before launch              |
| TM-015 | Invoke scheduled mutations without authorization                                            | Order corruption or forced retention work       | Exact Bearer credential, no query authentication, bounded counts, private response headers, generic errors, hourly Vercel schedule                                                                              | Rotate `CRON_SECRET` independently and on suspected exposure               |

## Security invariants

- Missing or invalid `BOOK_DELIVERY_LAUNCH_STATE` means closed.
- Public checkout checks the launch gate before body, rate-limit, database, or Stripe work.
- Provider calls do not run while order rows are locked.
- A persisted paid order is never moved back to pending, expired, failed, or cancelled.
- Fulfillment is never changed by a payment webhook or scheduled reconciliation.
- Staff cannot change provider-owned payment or refund state.
- Every applied order, catalogue, reconciliation, or retention mutation writes an audit row in the same transaction.
- Order lines and audit rows cannot be updated or deleted.
- Customer capabilities and provider identifiers do not appear in URLs or logs.
- Auth rate-limit rows contain only versioned HMAC keys. They do not contain client addresses or route paths.
- Fixed active auth paths have separate buckets. Every unmatched path for a client uses one stricter fallback bucket, so pre-routing checks cannot create an unbounded keyspace.
- Better Auth trusts `x-vercel-forwarded-for` only under the exact Vercel runtime flag. It never uses ordinary forwarding headers to divide auth quotas.
- Production artifacts contain no fixture catalogue identifier or title, fixture import path, local or Drive path, placeholder sentinel, client private environment name, credential-shaped value, or source map.

## Residual operational risks

The code cannot confirm tax treatment, refund policy, Stripe business configuration, Google Console callbacks, Vercel environment scopes, Wayne's Front Desk procedures, or Neon restore readiness. Those remain human launch gates in `docs/book-delivery-deployment.md`.

An approved staff account can still make a mistaken manual purchase or disclose data visible in the portal. Short sessions, audit history, least-privilege database access, and a one-account allowlist reduce the impact, but operating practice and Google account security remain important.

## Review focus

| Path                                           | Review concern                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| `src/routes/api/book-checkout/+server.js`      | Launch ordering, input bounds, origin, rate limit, capability issuance |
| `src/routes/api/stripe/webhook/+server.js`     | Raw signature, strict provider evidence, bounded response              |
| `src/lib/server/orders/webhook.js`             | Event idempotency, monotonic payment state, audit transaction          |
| `src/routes/api/cron/book-delivery/+server.js` | Exact authorization and private generic response                       |
| `src/lib/server/jobs/book-delivery.js`         | Batches, provider isolation, row locks, retention eligibility          |
| `src/hooks.server.js`                          | Session authorization and route-specific privacy headers               |
| `src/lib/server/auth`                          | Exact Google identity, session lifetime, revocation                    |
| `src/routes/staff`                             | Reauthorization, ID validation, transition and catalogue conflicts     |
| `src/lib/server/db` and `drizzle/`             | Constraints, connection lifecycle, immutable triggers, migration roles |
| `svelte.config.js` and `vercel.json`           | Single CSP owner, baseline headers, scheduled path                     |
| `scripts/production-artifact-scanner.mjs`      | Release data and secret leak prevention                                |
