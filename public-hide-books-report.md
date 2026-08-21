# Public Book Delivery removal report

## Scope

This deployment preparation removes the closed Book Delivery service from public discovery without deleting its routes, backend, or live test path. The service can continue to be developed behind the exact `live` launch state.

## Public behavior

- Wide, compact, and mobile navigation contain no Book Delivery item.
- The homepage contains no Book Delivery section, status message, link, or related promotional copy.
- The footer, public editorial routes, content model, static metadata, and image manifest contain no Book Delivery destination.
- Closed requests to `/books` and every nested `/books/*` route receive a server `303` redirect to `/` before a child route can load catalogue, cart, checkout, or confirmation data.
- The checkout endpoint remains fail closed. In the closed state it returns `503` before reading an invalid request body or reaching catalogue and payment dependencies.
- An exact `live` launch state still enables the existing Book Delivery route tree for development and automated tests.

There is no inactive hidden navigation item and no replacement copy was added.

## Test driven change

The component and route tests were changed first. They failed against the previous public links, homepage notice, and root launch page. The implementation then removed public discovery and moved the closed redirect to the parent route boundary.

The focused suite passes 36 of 36 tests across the header, homepage, and Book Delivery server layout.

## Repository gates

- Full Vitest suite with coverage: 60 files and 658 tests passed.
- Authored JavaScript coverage: 100 percent statements, branches, functions, and lines.
- Svelte check: zero errors and zero warnings.
- Prettier and ESLint: passed.
- Vite production build: passed.
- Git whitespace validation: passed.

The build reports only the existing optional dependency notices for OpenTelemetry and `utf-8-validate`, plus an upstream Better Auth unused import warning.

## Chrome smoke test

Installed Chrome checked the current server at 320, 768, and 1024 CSS pixels. The complete navigation regression passed 9 of 9 scenarios, including public routes, keyboard focus, mobile disclosure behavior, direct closed route requests, and unknown route recovery.

At every width:

- the homepage had zero `/books` links and no visible Book Delivery label;
- the document had zero horizontal overflow;
- `/books` redirected to `/`;
- `/books/cart` redirected to `/`;
- the redirected page showed the `Code. Collaborate. Create.` heading.

Direct HTTP checks independently confirmed `303` responses for `/books` and `/books/cart`. A malformed checkout request received `503` with the closed service response.

## Deployment readiness

The public source and server boundary are ready for a stable closed service deployment. Vercel authentication remains an external deployment prerequisite and is not claimed by this report.
