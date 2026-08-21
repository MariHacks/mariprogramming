# Durable controls foundation report

## Scope and outcome

Secure Work Unit 10's foundation is implemented without route wiring, CSP changes, response-header changes, or Better Auth limiter changes.

Added:

- `src/lib/server/security/rate-limit.js`
- `src/lib/server/security/rate-limit.test.js`
- `src/lib/server/security/rate-limit.integration.test.js`
- `src/lib/server/security/security-logger.js`
- `src/lib/server/security/security-logger.test.js`

The existing `rate_limit_buckets` schema and committed migration already matched the approved contract, so neither was changed.

## Rate-limit contract

- Uses the independent `RATE_LIMIT_HMAC_KEY` supplied by the validated runtime environment. No auth, cron, or provider secret is reused.
- Produces SHA-256 HMAC keys with an explicit `rl:v1:<domain>:` prefix and domain-separated input for normalized email, Vercel client address, staff session, and staff action.
- Never writes raw email, IP address, session ID, action subject, or HMAC secret to PostgreSQL.
- Normalizes email only by trimming and lowercasing; it does not reinterpret aliases.
- Accepts only a strict single IPv4 or IPv6 value from `x-vercel-forwarded-for` when `VERCEL === '1'`. It ignores `x-forwarded-for` and `x-real-ip`, rejects lists and malformed values, and otherwise hashes one shared anonymous subject. The shared fallback makes absent trusted-address traffic stricter than per-address traffic.
- This decision follows Vercel's current [Request headers documentation](https://vercel.com/docs/headers/request-headers), last updated December 13, 2025: Vercel identifies `x-vercel-forwarded-for` as its copy of the client address and warns that ordinary `x-forwarded-for` can be overwritten when another proxy sits above Vercel.
- Enforces the approved fixed policies rather than accepting caller-weakened values:
  - checkout email: 10 attempts per 15 minutes
  - checkout client address: 60 attempts per hour
  - staff session: 60 mutations per minute
  - staff action: 60 mutations per minute
- Rejects a key whose encoded domain does not match its database scope.
- Performs one parameterized `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` statement. PostgreSQL serializes the primary-key conflict; an expired window resets at `expires_at <= now`, while a live window increments atomically.
- Treats returned database state as untrusted. A returned window must start no later than the request timestamp, span exactly the approved policy duration, remain unexpired, and end no later than `now + windowMs`. Impossible future, shortened, or extended windows fail closed, while valid existing and newly reset windows remain accepted.
- Exposes both a transaction-bound primitive for checkout/staff transactions and a standalone request-scoped transaction wrapper.
- Returns only bounded usage/reset results. The temporal invariants also bound reset and retry values to the approved window. Invalid input is generic; database, cleanup, or malformed-result failures become a generic fail-closed `RATE_LIMIT_UNAVAILABLE` error.
- Better Auth remains the sole owner of OAuth/sign-in rate limiting. The application primitive is not wired to auth or signed webhook retries.

## Logger contract

- Event names are allowlisted to four bounded codes: authorization denial, webhook verification failure, rate-limit denial, and rate-limit infrastructure failure.
- Metadata is default-deny. Only allowlisted route templates, reason codes, scopes, HTTP status, bounded retry seconds, and sanitized error categories can be emitted.
- Query strings and fragments are stripped before route allowlisting.
- Customer email, raw IP, cookies, session/capability values, OAuth tokens, Stripe Session/PaymentIntent identifiers, secrets, provider payloads, request bodies, stacks, error messages, custom error fields, and raw attacker input are never copied.
- `Error`, nested `cause`, and `AggregateError` serialization retains only bounded error type and allowlisted application code. Recursion and cycles are capped. Aggregate serialization inspects at most 16 own numeric data descriptors and retains at most three sanitized errors, so sparse or attacker-sized arrays cannot cause an unbounded scan.
- Accessor properties and `toJSON` are never invoked. Prototype entries are ignored. The complete clock, metadata-sanitization, record-construction, and writer path is contained so throwing getters, revoked proxies, proxy traps, invalid clocks, and writer failures cannot turn a denial path into an application failure.

## TDD and database evidence

The first focused test run failed because the two production modules did not exist. After minimal implementation, specific failing tests exposed and drove:

- strict invalid-input behavior;
- exact limit-boundary and retry behavior;
- missing/error/malformed database results;
- Vercel-only address trust and anonymous fallback;
- query-string and sensitive-field removal;
- nested/cyclic error redaction;
- bucket-domain/scope mismatch rejection; and
- rejection of caller-weakened policies.

Adversarial review then reproduced two additional RED cases and drove the final hardening:

- an accessor-bearing `AggregateError.errors` array escaped the logger before the writer guard; and
- a malformed database result with a future but internally ordered window was accepted.

The resulting regression tests cover accessor and prototype aggregate entries, bounded sparse-array inspection, ordinary and revoked proxies, descriptor/prototype traps, `toJSON`, clock failures, valid pre-existing windows, future starts, and incorrect window durations.

The disposable PostgreSQL integration test applies the committed migration, executes the production compiled upsert through PostgreSQL 16, and proves:

- 20 concurrent consumers receive each count from 1 through 20 exactly once;
- exactly the first 10 are allowed for the checkout-email policy;
- the persisted count is 20; and
- a request at the exact expiry instant resets count to 1 and starts the next full window.

## Verification

- `npx vitest run src/lib/server/security --coverage --coverage.include='src/lib/server/security/*.js'`: 79 tests passed; lines, branches, functions, and statements all 100%.
- `npx vitest run --coverage`: 63 files and 737 tests passed; authored JavaScript lines, branches, functions, and statements all 100%.
- `npm run check`: 0 errors and 0 warnings.
- `npm run lint`: passed with all files formatted.
- `npm run build`: passed. Existing non-blocking Better Auth optional instrumentation and `utf-8-validate` notices remain unchanged.
- `git diff --check`: passed.

## Deferred integration

Checkout and staff mutation routes must call these primitives in their owning work units, return 429 with the supplied retry guidance when `allowed` is false, and return a generic unavailable response when the limiter fails closed. The valid signed Stripe webhook path remains exempt. CSP, baseline headers, route-specific cache/noindex/no-referrer policy, and deployed header verification remain in the later WU10 integration phase.
