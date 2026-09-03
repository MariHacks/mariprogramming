# Book Delivery deployment and recovery runbook

This runbook covers the Book Delivery backend, staff portal, scheduled recovery, and provider setup. The public service stays closed until every launch approval and provider test is complete. The programming club site can be deployed while `BOOK_DELIVERY_LAUNCH_STATE=coming-soon`.

Operational owner: `team@marihacks.com`

Production origin: `https://mariprogramming.vercel.app`

## Release states

| State              | Public Book Delivery routes                                         | Homepage                | Staff portal                            | Webhook and scheduled job                              |
| ------------------ | ------------------------------------------------------------------- | ----------------------- | --------------------------------------- | ------------------------------------------------------ |
| `coming-soon`      | Redirect to the homepage before catalogue, database, or Stripe work | Shows `Coming Soon`     | Available to the approved staff account | Available for recovery and testing                     |
| `live`             | Catalogue, cart, checkout, and confirmation are available           | May link to the service | Available to the approved staff account | Required                                               |
| Missing or invalid | Treated as `coming-soon`                                            | Shows `Coming Soon`     | Available to the approved staff account | Available when their own narrow configuration is valid |

Never use `live` as a temporary troubleshooting step. It is a public launch decision.

## 1. Local release preflight

Use Node 22 and a clean dependency install. Run these commands from the repository root:

```sh
node --version
npm --version
git status --short
npm ci
npm run verify:release
```

`verify:release` runs formatting and lint checks, `svelte-check`, the full authored JavaScript coverage gate, a production build, the production artifact scanner, the closed-release Chrome suite, and the live Book Delivery profile. The live profile uses disposable loopback PostgreSQL and local Stripe and auth doubles. It does not use provider credentials or call external services. The scanner checks `.vercel/output` and fails on test catalogue data, local and Google Drive paths, placeholder asset markers, source maps, private environment names in client output, and credential-shaped values.

The scanner reads every bounded regular file. Unapproved file types must contain valid UTF-8. Approved binary formats are still searched byte for byte for ASCII leak markers in metadata and payloads.

The postbuild step never deletes source-map files. It may remove a terminal local-map comment only from an audited server package when the canonical Vercel path, exact package version, and full comment inventory match the checked-in digest. A dependency update or any new map shape fails closed until it is reviewed and the production scanner tests are updated.

Check that the intended environment contains every required name without printing its value:

```sh
node -e "const names=['APP_ORIGIN','BETTER_AUTH_URL','DATABASE_URL','BETTER_AUTH_SECRET','RATE_LIMIT_HMAC_KEY','BOOK_CHECKOUT_CAPABILITY_KEY','CRON_SECRET','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','BOOK_DELIVERY_LAUNCH_STATE']; const missing=names.filter((name)=>!process.env[name]); if(missing.length){console.error('Missing environment names: '+missing.join(', ')); process.exit(1)} console.log('Required environment names are present')"
```

Do not paste values into terminal history, tickets, screenshots, or this repository. Generate `BETTER_AUTH_SECRET`, `RATE_LIMIT_HMAC_KEY`, `BOOK_CHECKOUT_CAPABILITY_KEY`, and `CRON_SECRET` independently. Each must contain at least 32 high-entropy characters. Do not reuse a provider key for an application secret.

## 2. Neon databases and roles

Create separate Neon projects or isolated branches for protected staging and production. Do not point Preview deployments at the production database.

Provision two database roles in each environment:

- `mariprogramming_migrator` owns schema changes and is used only by a controlled operator.
- `mariprogramming_runtime` is used by the application and has only the data privileges below.

Keep the unpooled migration connection in `MIGRATION_DATABASE_URL`. Keep the runtime connection in `DATABASE_URL`. Do not add `MIGRATION_DATABASE_URL` to the Vercel application environment.

After an administrator creates the roles and the migrator owns the application schema, apply migrations with:

```sh
MIGRATION_DATABASE_URL="$STAGING_MIGRATION_DATABASE_URL" npm run db:migrate
MIGRATION_DATABASE_URL="$PRODUCTION_MIGRATION_DATABASE_URL" npm run db:migrate
```

Run production only after the protected staging migration and smoke tests pass. Migrations never run during application startup.

Run the following grant block as the schema owner after every migration. Replace the runtime role only if the approved role name changes:

```sql
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO mariprogramming_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  "user", "session", "account", "verification"
TO mariprogramming_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE
  teachers, courses, bookstores, books, course_books, orders, checkout_attempts, stripe_events
TO mariprogramming_runtime;
GRANT SELECT, INSERT ON TABLE
  order_lines, audit_log
TO mariprogramming_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  rate_limit_buckets
TO mariprogramming_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mariprogramming_runtime;
```

Better Auth uses the same `rate_limit_buckets` table through an atomic custom storage adapter. Its
keys are versioned HMAC digests in the `auth_request` scope. The runtime never stores a raw client
address or auth path in a limiter key. The scheduled maintenance job removes expired auth,
checkout, and staff buckets through the same bounded cleanup. The legacy Better Auth `rate_limit`
table is removed by migration `0004_overrated_starhawk.sql` and must not be recreated or
granted to the runtime role.

Better Auth applies the limiter before it decides whether a route exists. The adapter gives
separate buckets only to `/sign-in/social`, `/callback/google`, `/get-session`, `/sign-out`, `/ok`,
and `/error`. Every other path for the same client uses one fallback bucket capped at three
requests per 10 seconds. A malformed raw limiter key is rejected before database work. This keeps
attacker-chosen paths from growing the table.

Auth quotas use `x-vercel-forwarded-for` only when Vercel supplies its exact `VERCEL=1` platform
flag. Ordinary forwarding headers are ignored. Outside Vercel, all requests use the same client
subject. Known auth paths still have separate buckets, while unmatched paths share one fallback
bucket. Do not set `VERCEL` yourself.

The checked-in migration adds database triggers that reject updates and deletes to `order_lines` and `audit_log`. Verify them after migration:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('order_lines_immutable','audit_log_append_only') ORDER BY tgname"
```

Do not seed test teachers, books, customers, or orders. Add the real teacher, course, bookstore, and book records through the staff catalogue after authentication has passed. Before launch, confirm no fixture names are present:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT count(*) AS fixture_rows FROM teachers WHERE name IN ('Mme Tremblay','Mr Bennett')"
```

### Migration workflow

1. Change the Drizzle schema and add a failing migration integration test.
2. Run `MIGRATION_DATABASE_URL="$LOCAL_DATABASE_URL" npm run db:generate`.
3. Review the generated SQL, constraints, locks, defaults, grants, and rollback compatibility.
4. Apply every migration to disposable PostgreSQL and run the full test suite.
5. Apply to protected staging. Run checkout, webhook, scheduled job, retention, and staff smoke tests.
6. Confirm a current Neon restore point or branch before production.
7. Apply to production with the controlled migration role.
8. Reapply and verify runtime grants.

Use a forward migration to repair schema mistakes. Do not run an unreviewed reverse migration against orders or audit history.

## 3. Google sign-in

Better Auth uses Google only. The application accepts one identity: the verified Google account whose normalized email is exactly `team@marihacks.com`. Aliases, lookalike domains, unverified emails, and other Google accounts are denied before a staff session is issued.

Register these callback shapes in the Google OAuth client. The local entry must use the
exact host and port from `APP_ORIGIN` (`127.0.0.1` and `localhost` are different origins to
Google):

```text
http://127.0.0.1:<dev-port>/api/auth/callback/google
http://localhost:<dev-port>/api/auth/callback/google
https://<stable-protected-staging-domain>/api/auth/callback/google
https://mariprogramming.vercel.app/api/auth/callback/google
```

MariTools Calendar Connect reuses the same Web client and needs a second redirect path for
each origin you use:

```text
http://127.0.0.1:<dev-port>/tools/schedule/google-calendar/callback
https://<stable-protected-staging-domain>/tools/schedule/google-calendar/callback
https://mariprogramming.vercel.app/tools/schedule/google-calendar/callback
```

`GOOGLE_CLIENT_ID` must be a real Google Cloud OAuth **Web application** client ID of the form
`<digits>-<suffix>.apps.googleusercontent.com`. Placeholder values such as
`local-dev.apps.googleusercontent.com` produce Google's `Error 401: invalid_client`. Set
`GOOGLE_CLIENT_SECRET` to the matching client secret from the same OAuth client.

The staging entry must use the final protected staging domain, not an ephemeral Preview URL. Set `APP_ORIGIN` and `BETTER_AUTH_URL` to the exact origin for each environment. Do not include a path or trailing slash.

Google verification smoke:

1. Open `/staff/sign-in` in a clean browser profile.
2. Sign in with `team@marihacks.com`. Confirm `/staff` loads and the session cookie is Secure, HttpOnly, SameSite Lax, and expires within eight hours.
3. Sign out and confirm the session no longer opens `/staff`.
4. Use a different verified Google account. Confirm the flow is denied and no application session is created.
5. Revoke the approved account's application access in Google, then confirm reauthentication is required.

Never broaden the email allowlist to make a smoke test pass.

## 4. Stripe Checkout, webhooks, and receipts

Use a separate Stripe test account or test mode for local and protected staging. Live keys belong only in the Vercel Production scope after launch approval.

Register these webhook endpoints:

```text
https://<stable-protected-staging-domain>/api/stripe/webhook
https://mariprogramming.vercel.app/api/stripe/webhook
```

Subscribe only to:

- `checkout.session.completed`
- `checkout.session.expired`
- `charge.refunded`

Store each endpoint's signing secret in the matching `STRIPE_WEBHOOK_SECRET`. A test signing secret never validates live events, and a live signing secret never belongs in Preview.

For local signed delivery:

```sh
stripe listen --forward-to http://localhost:5173/api/stripe/webhook
```

For a controlled replay, copy the event ID and webhook endpoint ID from Stripe without putting either in source control, then run:

```sh
stripe events resend "$STRIPE_EVENT_ID" --webhook-endpoint "$STRIPE_WEBHOOK_ENDPOINT_ID"
```

Confirm the first valid event makes one monotonic transition and the replay is a bounded no-op. Check the order and audit row in the staff portal. Do not treat the Stripe return URL as payment proof.

Before live payment approval:

1. Complete Stripe business identity and public support details.
2. Configure receipt branding.
3. Enable successful payment emails under Customer emails.
4. Complete a test Checkout with an approved test receipt address.
5. Confirm every book, one service fee per bookstore, tax, total, success redirect, and cancellation redirect.
6. Deliver and replay the signed completion event.
7. Test Session expiry and a Dashboard refund. Confirm the signed webhook updates the order without changing fulfillment.

Refunds begin in the Stripe Dashboard. Staff order actions do not create refunds.

## 5. Vercel environment scopes

Audit every name in Vercel before a release:

| Name                                  | Development                 | Protected staging or Preview    | Production                                         |
| ------------------------------------- | --------------------------- | ------------------------------- | -------------------------------------------------- |
| `APP_ORIGIN`, `BETTER_AUTH_URL`       | Local origin                | Stable protected staging origin | Production origin                                  |
| `DATABASE_URL`                        | Local disposable database   | Isolated staging database       | Production runtime database                        |
| Application secrets                   | Local-only values           | Independent staging values      | Independent production values                      |
| Google credentials                    | Approved development client | Approved staging client         | Approved production client                         |
| Stripe key and webhook secret         | Test mode                   | Test mode only                  | Live only after approval, otherwise test or absent |
| `BOOK_DELIVERY_LAUNCH_STATE`          | `live` for local testing    | `live` for protected acceptance | `coming-soon` until launch approval                |
| Approved bookstore hosts and tax rate | Test values                 | Proposed production values      | Approved production values only                    |
| `MIGRATION_DATABASE_URL`              | Operator shell only         | Operator shell only             | Operator shell only                                |

Enable Vercel deployment protection for staging and Preview. Never expose a Preview that holds provider credentials or customer data.

## 6. Scheduled recovery and retention

`vercel.json` invokes `GET /api/cron/book-delivery` daily at 03:17 UTC while the service is closed, which is compatible with the current Vercel Hobby plan. Before setting `BOOK_DELIVERY_LAUNCH_STATE=live`, move this job to an hourly scheduler or upgrade the Vercel plan and restore an hourly expression. The endpoint accepts only the exact header `Authorization: Bearer ${CRON_SECRET}`. Query parameters and alternate schemes do not authenticate.

Manual authorized smoke:

```sh
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://mariprogramming.vercel.app/api/cron/book-delivery"
```

Unauthorized smoke:

```sh
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' \
  "https://mariprogramming.vercel.app/api/cron/book-delivery"
```

The authorized job processes at most 20 checkout attempts, 100 PII records, and 100 expired rate buckets per run. Stripe calls happen outside database transactions. Database state changes use row locks, version checks, and same-transaction audit rows.

The retention policy is 90 days after a failed, expired, cancelled, or refunded payment, or after completed pickup when a purge date has been set. Purge replaces customer name and email with non-personal sentinels and clears the confirmation capability and expiry. It keeps totals, immutable order lines, provider references needed for finance, status, and audit history.

If a run returns 503, inspect bounded application event codes and provider health, then retry. Do not increase batch limits during an incident.

Rotate `CRON_SECRET` by setting a new independent production value and redeploying. Vercel Cron uses the current Production value on its next invocation. Revoke the old value anywhere it was stored.

## 7. Coming Soon deployment smoke

Run these checks on the deployment selected for promotion:

```sh
curl --fail --silent --show-error "https://mariprogramming.vercel.app/" > /dev/null
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' "https://mariprogramming.vercel.app/books"
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' "https://mariprogramming.vercel.app/api/cron/book-delivery"
curl --silent --show-error --head "https://mariprogramming.vercel.app/staff/sign-in"
```

Expected results:

- The homepage is 200 and shows the Book Delivery `Coming Soon` status.
- `/books` redirects to the homepage while the launch state is closed.
- An unauthenticated scheduled request is 401.
- Staff, API, checkout, and confirmation responses use no-store, noindex, and no-referrer policies.
- Global responses include HSTS, frame denial, MIME sniffing denial, a restrictive permissions policy, and SvelteKit's CSP.
- The public build contains no source maps or test catalogue data.

Repeat the responsive browser suite in Chrome at mobile and desktop sizes. Test the public navigation, approved staff sign-in recovery, denied identity path, empty catalogue, order ledger filters, order detail, and sign-out.

## 8. Public launch approvals

Keep Production at `coming-soon` until a named human records approval for all of these:

- Applicable Quebec and Canadian tax treatment for books and the service fee
- Refund, cancellation, unclaimed-book, and customer communication policy
- Stripe business identity, support contact, branding, and email receipts
- Final teacher, course, book, bookstore, price, and approved hostname records
- Wayne's Front Desk receiving, storage, identity check, pickup, and escalation process
- Production database restore test and retention ownership
- Approved and denied Google account smoke
- Live Stripe checkout, signed webhook, replay, expiry, and refund smoke

After approval, change only `BOOK_DELIVERY_LAUNCH_STATE` to exact lowercase `live`, deploy, and repeat the full smoke suite. Missing or malformed values fail closed.

## 9. Rollback and incident response

### Application rollback

1. Set `BOOK_DELIVERY_LAUNCH_STATE=coming-soon` first if payment or catalogue behavior is uncertain.
2. Promote the last known-good Vercel deployment.
3. Keep the signed webhook and authorized scheduled job available so already-created payments can settle and reconcile.
4. Verify public routes are closed, staff authentication still works, and payment state did not regress.
5. Use a reviewed forward database repair. Do not reverse a migration that could discard orders, provider events, capabilities, or audits.

### Credential response

- Database exposure: rotate runtime and migration passwords, revoke active database sessions, audit Vercel scopes, and review database logs.
- Google client exposure: rotate the client secret, revoke OAuth grants, rotate `BETTER_AUTH_SECRET`, and invalidate application sessions.
- Stripe secret exposure: roll the Stripe key and webhook signing secret, review events and payments, then update the exact Vercel Production values.
- Confirmation capability concern: close the service, clear affected capability hashes and expiry values, and contact affected customers through the approved process.
- Cron secret exposure: rotate `CRON_SECRET`, redeploy, and remove the old value from every operator store.

Use the structured security event codes for triage. Do not add customer email, cookies, confirmation values, provider payloads, or full query strings to logs during an incident.

## 10. Backups and recovery

Before live approval, enable and document the Neon backup or point-in-time recovery window for production. Record the account owner, retention window, and last restore-test date outside this public repository.

At least once before launch and after major schema changes:

1. Create a protected recovery branch or restore point.
2. Restore into an isolated database.
3. Apply current runtime grants.
4. Run migration checks and read-only order totals.
5. Confirm audit and immutable order-line triggers exist.
6. Run the application against the restored database in protected staging.
7. Delete the isolated recovery resource after the test and record the result.

Never test restoration by overwriting the production database.
