# Staff catalogue report

## Scope and outcome

The protected Programming Club staff shell and catalogue work unit are implemented. Independent review identified an inaccessible row-action failure state, missing bounded row context on guard failures, a missing progressive-enhancement path, and a misleading post-success failure edge. Every finding is fixed, and the final read-only rereview passed.

This work unit covers:

- a protected staff shell with Programming Club branding, catalogue navigation, a factual disabled Orders destination, the authorized identity, and sign out;
- list, search, create, update, activate, and deactivate operations for teachers, courses, bookstores, books, and course assignments;
- strict staff mutation request handling, durable rate limits, validation, optimistic concurrency, and transactional audit records; and
- a responsive editorial operations interface with desktop tables and labeled mobile rows.

Staff order operations, exports, reconciliation, deployment, and public-site header changes are outside this work unit and were not added.

## Authorization and request boundary

- Every staff layout load, catalogue load, redirect load, and named mutation action requires the exact persisted staff authorization supplied by `requireStaff`.
- The public site header and footer are suppressed for `/staff` and nested routes. The protected shell is never rendered for the sign-in route without an authorized staff identity.
- Better Auth now identifies the application as `Marianopolis Programming Club Staff` instead of `MariHacks Staff`.
- Only named POST actions mutate state. No GET route changes catalogue data.
- The centralized mutation guard authorizes first, then reads a bounded form, verifies the exact configured origin, consumes durable staff-session and action rate limits in a separately committed transaction, and only then allows catalogue validation and the business transaction.
- Form bodies are limited to 16 KiB and must be UTF-8 URL-encoded forms. Missing or unsupported media types, malformed or oversized lengths, invalid UTF-8 bytes, malformed percent encoding, repeated fields, unknown fields, missing fields, files, empty bodies, and reader failures are rejected with bounded responses.
- Rate-limit buckets use HMAC-derived subjects. Both results must be valid and allowed. A denial returns `Retry-After`; persistence or malformed state fails closed. Security events use the bounded security logger and never copy request content or credentials.
- For row mutations, the guard retains only one strict UUID after the bounded body has passed its media, size, field, and encoding checks. That identifier can preserve row context through a rate-limit or availability response. It is revalidated by the route and resolved against the loaded records before a name is displayed. No other submitted value is retained or echoed.
- Request identifiers must be valid UUIDs. Configuration, clock, identifier, database, and logger-adjacent failures are mapped to generic responses without internal details.

## Catalogue and audit integrity

- The repository supports all five approved resource types through explicit definitions. It does not expose a generic table or column selector.
- Prices and fees are parsed as exact decimal cents without floating-point arithmetic. Store fees are constrained to CAD $5.00 through $7.00.
- ISBN values are normalized and checksum validated. Retailer and cover URLs must be HTTPS URLs on an exact configured hostname. The server does not fetch either URL, so the feature does not create an SSRF path.
- Teacher, course, bookstore, book, and assignment relationships are checked inside the mutation transaction. Assignment course and book identity cannot be changed after creation; only its position can be edited.
- Updates and state changes lock the current row and compare the supplied version. A successful mutation increments the version. A stale writer receives a bounded conflict response.
- Records are never deleted or cascaded from this interface. Deactivation preserves history. Staff reads show both direct state and effective public visibility, including the inactive ancestor that is hiding a child record.
- The catalogue mutation and audit insert share one transaction. Audit state contains the resource identity, action, actor, request UUID, versions, active states, and changed field names. It never stores raw retailer or cover URLs, request bodies, provider tokens, cookies, or secrets.
- Malformed persisted rows and impossible result shapes fail closed instead of being partially displayed.

## Staff interface

- The interface uses cool white and blue surfaces, ruled sections, square controls, compact typography, and a dense operational hierarchy. It does not use beige, decorative card grids, gradients, or playful visual treatments.
- Each resource view includes a search field, result count, Add action, selected editor, direct and public state, and an inline confirmation before deactivation.
- Desktop uses semantic tables. At narrow widths the same rows become labeled record sections without changing reading order.
- Every failed mutation renders one page-level error summary, including activate and deactivate failures when no editor is open. It names the attempted action and record when bounded record context is available. Real SvelteKit `use:enhance` callbacks apply bounded action results, always clear the submitting state, and move focus to an assertive, atomic alert. Network failures receive a generic bounded message. A client-side apply or refresh failure after a server-confirmed mutation preserves the truthful success state instead of inviting an unsafe retry. Native named POST actions remain available without JavaScript. Field messages remain associated through `aria-describedby`.
- Interactive targets are at least 44 by 44 pixels. Keyboard focus uses a visible 3 pixel outline. The interface includes reduced-motion and forced-colors rules.
- UI copy was reviewed for direct operational value. It contains no filler, middle-dot separators, or long-dash constructions.
- The Impeccable detector returned no findings for the staff shell and catalogue page.

## Verification

### Attributable gates

- Focused work-unit run: 13 test files and 409 tests passed.
- Review regression coverage exercises both activate and deactivate actions at 409, 429, and 503 through the route and the actual enhancement callback. It verifies strict record context, one alert, assertive live-region semantics, focus transfer, and submitting-state reset. It also covers pending, success, bounded network-error results, and rejected post-success apply and refresh calls while retaining the no-JavaScript POST fallback.
- Full Vitest run with four bounded workers: 83 test files and 1,521 tests passed with 100% statements, branches, functions, and lines across authored JavaScript.
- PostgreSQL 16.1 integration: 4 tests passed from a disposable cluster after applying migrations from zero. They cover Better Auth user foreign keys, CRUD and public visibility, non-cascading deactivation, concurrent stale writers, and audit rollback.
- `npm run check`: 0 errors and 0 warnings.
- Repository-wide Prettier: all matched files formatted correctly.
- Scoped ESLint for the authored staff shell, catalogue, request guard, repository, and environment files: no issues found. The separately existing staff sign-in page retains one deferred navigation-rule error described below.
- `npm run build`: passed. The staff catalogue client node is 29.19 KiB before gzip and 8.40 KiB after gzip. Existing optional Better Auth instrumentation and `utf-8-validate` build notices remain non-blocking.
- Client output scan: no database URL, environment key name, Google client secret, Stripe secret, PostgreSQL credential, private test secret, or approved-host configuration leaked into the browser bundle.
- `git diff --check`: passed.

### Installed Chrome review

The production-compiled staff page and extracted production CSS were rendered in a fresh no-cookie Chrome context without adding an authentication bypass to application code.

- Teacher list: 320, 768, and 1440 pixel viewports passed with document width exactly equal to viewport width.
- The failed row-action view passed at 320 and 1440 pixels. The visible alert contained the named action and record, exposed `role="alert"` with `aria-live="assertive"`, accepted focus, and showed its 3 pixel focus treatment.
- Book list and editor: 320 and 1440 pixel viewports passed with document width exactly equal to viewport width.
- Every visible link, button, input, select, and disclosure control in the harness measured at least 44 by 44 pixels.
- Keyboard traversal reached a resource link with a visible 3 pixel focus outline.
- The native deactivate disclosure revealed the correct named POST action.
- Forced-colors and reduced-motion media states were exercised successfully.
- Captures are in `test-results/staff-catalogue/`.

The real staff route was also exercised with deliberately local, non-production configuration. It returned a generic `503` with `cache-control: no-store` because the production Neon WebSocket database transport does not connect to a local PostgreSQL socket. Authentication was not weakened to work around that environmental boundary.

## Repository gate outside this work unit

The review requested two narrow test-hygiene changes outside the catalogue implementation:

- The default-clock checkout test now uses a test-only Unix-epoch attempt date, so it remains beyond the replay window regardless of the date the suite runs. Production checkout code is unchanged.
- The two concurrently changed event files were mechanically formatted after their diffs were inspected. Their focused tests pass and no event behavior was changed.

The full `npm run lint` now passes Prettier, then stops at 41 existing `svelte/no-navigation-without-resolve` errors across 17 public or book-delivery files plus the pre-existing staff sign-in page. None is in the staff shell, catalogue, request guard, repository, or owned tests. The parent work unit explicitly deferred those unrelated navigation migrations to final integration and hardening, so this revision does not broaden its ownership to edit them.

## Review boundary

This implementation has not been committed or deployed. The final independent read-only review passed after verifying the repaired guard context, progressive-enhancement paths, and truthful post-success behavior.
