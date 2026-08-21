# Release hardening report

Date: 2026-08-13

Scope: WU10 and WU11 operational hardening for the Programming Club release and the closed Book Delivery backend.

No deployment, provider registration, credential creation, database mutation outside disposable test clusters, commit, or push was performed.

## Release boundary

- Production Book Delivery remains closed by default. Missing, malformed, and exact `coming-soon` launch states redirect dedicated public routes before catalogue, database, or Stripe work.
- The homepage keeps the plain `Coming Soon` status.
- The release Chrome profile excludes three browser specs that depended on the removed in-browser fixture catalogue. It tests the actual closed release instead. Persistent catalogue, checkout, payment, confirmation, staff, and concurrency behavior is covered by the full unit and disposable PostgreSQL suites.

## Scheduled recovery

- Added `GET /api/cron/book-delivery` for Vercel Cron with exact `Authorization: Bearer ${CRON_SECRET}` authentication. Query credentials, altered schemes, extra whitespace, and wrong values fail.
- Added an explicit `HEAD` response. It returns a private, bodyless 405 for authenticated and unauthenticated requests without reading configuration or touching Stripe, the database, or the job runner.
- The endpoint reads only `DATABASE_URL`, `STRIPE_SECRET_KEY`, and `CRON_SECRET`. Responses are bounded, generic, no-store, noindex, and no-referrer.
- Each run lists at most 20 due attempts. Provider calls happen outside transactions. State mutations use short transactions, row locks, version checks, and same-transaction audit rows.
- Providerless attempts are failed only after one hour. Ready Sessions reconcile only from strict Stripe evidence. Paid state is monotonic and fulfillment is not changed.
- Provider failures do not skip retention or rate-limit maintenance. They produce a retryable 503.

## Retention

- Each run anonymizes at most 100 due terminal orders and deletes at most 100 expired rate-limit buckets.
- Customer name and email are replaced with non-personal sentinels. Confirmation hashes and expiry values are cleared. Finance, provider, order-line, status, and audit facts remain.
- The selector handles partially anonymized rows and rows whose PII is already replaced but whose confirmation hash or expiry remains. The audit records the actual PII and capability state found before each purge.
- Real PostgreSQL tests cover concurrent abandoned-attempt reducers, paid precedence over delayed expiry, partial PII cleanup, capability-only cleanup, concurrent purge claims, idempotence, and expired bucket deletion.

## Authentication rate limiting

- Better Auth uses the existing durable `rate_limit_buckets` table through a custom atomic storage adapter. Authentication request subjects are versioned HMAC digests. Raw addresses and paths are not stored.
- The fixed Better Auth rules use the same bounded database upsert as checkout and staff limits. Storage failures stop authentication before OAuth state is issued.
- Fixed active auth paths have separate buckets. Unknown and dynamic paths for one client share a three-request, 10-second fallback bucket, including paths rejected after Better Auth's pre-routing limit check. Malformed raw limiter keys fail before database work.
- Better Auth reads only Vercel's `x-vercel-forwarded-for` header when the runtime has the exact platform flag `VERCEL=1`. It ignores ordinary forwarding headers. Outside Vercel, all requests use the same client subject.
- Migration `0004_overrated_starhawk.sql` removes Better Auth's legacy `rate_limit` table and adds the `auth_request` scope. The runtime grant and scheduled cleanup now cover the same HMAC-keyed table.
- Real Better Auth tests run under a least-privilege PostgreSQL runtime role. They prove that spoofed forwarding headers do not split quotas, trusted client addresses remain distinct, unmatched paths consume one fallback row, and raw addresses and paths never enter the database. Only Google's token and profile network calls are replaced in the OAuth test.

## Browser and platform controls

- SvelteKit is the single CSP owner. The policy includes `default-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, self-hosted fonts and styles, the required Google map frame, and no `unsafe-eval`.
- The app shell style is external CSS. SvelteKit's generated announcer receives one exact `style-src-attr` hash through `unsafe-hashes`; the policy does not allow broad inline styles. Production Chrome reports no CSP errors and computes the shell and announcer styles correctly.
- Vercel owns the non-conflicting baseline headers: MIME sniffing denial, frame denial, strict origin referrer policy, restricted permissions, and HSTS.
- Staff, auth, API, cart, checkout, and confirmation responses receive private no-store, no-cache, noindex, and no-referrer policies. `robots.txt` also disallows those paths.
- Public staff sign-in now reads only the canonical application origin and remains available for recovery when auth persistence or unrelated provider configuration is unavailable.
- All 41 Svelte navigation lint violations were repaired with `$app/paths.resolve` for internal routes. External URLs keep safe external-link behavior.

## Production artifact checks

- Added a deterministic scanner for case-insensitive source-map suffixes and directives, the complete test catalogue identifiers and titles, fixture import paths, the supplied private Drive folder, placeholder sentinels, local and temporary paths, credential-shaped values, and private environment names in client output.
- The scanner reads every bounded regular file once. Unapproved file types must contain valid UTF-8 or the scan fails. Approved binary formats are still searched byte for byte for ASCII leak markers, so images, fonts, native modules, and WebAssembly cannot hide source-map references, credentials, or private paths in metadata.
- `verify:production` builds and scans the actual `.vercel/output` tree. The scanner treats `static/` as client code and follows only valid in-root Vercel function directory symlinks. It rejects broken, cyclic, escaping, file-target, and unexpected symlinks.
- Postbuild sanitation never deletes a map file. It removes only exact terminal local-map comments from five audited server packages when the canonical Vercel path, package name, pinned version, and complete directive inventory digest all match. New packages, changed inventories, alternate comment shapes, application files, client files, inline maps, URLs, traversal paths, and every map file remain scanner failures. Repeated sanitation is idempotent.
- `verify:release` runs formatting, ESLint, Svelte diagnostics, full coverage, the production artifact gate, the closed-release Chrome suite, and the separate live Book Delivery profile.

## Live browser profile

- The default Chrome profile still verifies the public Coming Soon release and does not open Book Delivery.
- `npm run test:e2e:live` creates a disposable loopback PostgreSQL cluster, applies every committed migration, seeds local test records, and starts the application on an ephemeral loopback port.
- The live profile replaces database transport, Stripe, and authentication only through a guarded test configuration. It rejects public origins, non-loopback databases, and non-local provider credentials. Browser traffic to non-loopback hosts is blocked.
- Chrome covers the database catalogue, course selection, book opt-out, cart, checkout review, real checkout POST, persisted order and attempt state, local Stripe handoff, unauthenticated staff recovery, and the same order in an authenticated staff ledger.

## Operations documentation

- `.env.example` documents separate runtime and migration credentials, independent application secrets, cron rotation, launch state, provider secrets, approved catalogue hosts, and tax configuration.
- `docs/book-delivery-deployment.md` covers Neon roles and grants, controlled migrations, exact Google callbacks and approved account tests, Stripe webhooks and replay, receipts, Vercel scopes, scheduled work, Coming Soon and live gates, smoke tests, rollback, revocation, backups, and restore tests.
- `docs/book-delivery-operations.md`, `PRODUCT.md`, `DESIGN.md`, and `club-book-delivery-threat-model.md` reflect the durable staff flow, closed release, retention, recovery, and residual human approvals.

## Verification evidence

Final all-in-one command:

```sh
npm run verify:release
git diff --check
```

Result:

- Prettier and ESLint: passed.
- `svelte-check`: 0 errors and 0 warnings.
- Vitest: 97 files and 2,042 tests passed.
- Authored JavaScript coverage: 100% statements, branches, functions, and lines.
- Disposable PostgreSQL migration, jobs, staff, confirmation, rate-limit, and race tests: passed.
- Production build: passed.
- Artifact scan: 1,184 unique files and 7,975,255 bytes across 32 validated route symlinks, with no findings.
- Closed-release Chrome suite: 20 tests passed across mobile and desktop, including the production CSP probe.
- Live Book Delivery support tests: 9 passed.
- Live Book Delivery Chrome suite: 1 test passed against disposable PostgreSQL.
- Diff whitespace check: passed.

## Dependency audit

`npm audit --omit=dev` reported no high or critical finding. It reported seven low or moderate transitive advisories:

- SvelteKit 2.70.2 currently resolves `cookie` 0.6.0, covered by a cookie validation advisory.
- Drizzle Kit retains an older development-only `@esbuild-kit` and esbuild chain.

The audit tool proposed breaking framework and migration-tool downgrades, so no automatic fix was applied. Review a tested SvelteKit or `cookie` upgrade and a Drizzle Kit dependency refresh as a separate dependency update before public Book Delivery launch.

## External launch gates

The repository cannot verify Google Console callbacks, the exact approved Google account, Stripe webhook registration and receipts, Vercel environment scopes, live Stripe mode, Neon backup ownership, tax and refund policy, real catalogue records, or Wayne's Front Desk procedures. Keep Production at `coming-soon` until the deployment runbook approvals and protected staging smokes are complete.

This work is ready for a fresh independent review. It is not a deployment approval.
