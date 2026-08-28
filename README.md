# Marianopolis Programming Club

The Marianopolis Programming Club website is a SvelteKit project for club workshops, events,
learning resources, MariTools student tools (`/tools`), and the independent Book Delivery
service (`/books`).

## Requirements and setup

- Node.js 22, matching the Vercel runtime
- npm
- Chromium for the browser-quality gate

Install the locked dependency set:

```sh
npm ci
npx playwright install chromium
```

Only Chromium is required by the project tests.

## Development

Start the local development server:

```sh
npm run dev
```

Copy `.env.example` to `.env.local` and fill server-only values. For Google sign-in on
`/tools/account` or `/staff/sign-in`:

1. In Google Cloud Console, create (or reuse) an OAuth **Web application** client.
2. Add the authorized redirect URI
   `http://127.0.0.1:<dev-port>/api/auth/callback/google` (and `http://localhost:<dev-port>/...`
   only if that is your `APP_ORIGIN`).
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local` to that client.
4. Set `APP_ORIGIN` and `BETTER_AUTH_URL` to the same origin the browser uses, for example
   `http://127.0.0.1:5173`.

Placeholder client IDs are rejected at startup. Google itself returns `invalid_client` when a
nonexistent client ID reaches the authorize endpoint.

The club routes are `/`, `/about-us`, `/our-workshops`, `/events`, and `/resources`. Book
Delivery begins at `/books`; commerce controls belong only within that route area.

## Content maintenance

Current club copy and structured event, workshop, and resource records live in
`src/lib/content/club.js`. Update that source rather than duplicating content in page layouts.

- Add only confirmed events, including an ISO date in `startsAt`.
- Keep workshops grouped with `track` and `term`, and preserve source links.
- Keep learning resources grouped by student goal.
- Change `communityAction` once the club has a verified current destination.

The page and shared-component tests show the required record shapes.

## Quality gates

Run the same checks before opening a pull request:

```sh
npm run test
npm run check
npm run lint
npm run test:e2e
npm run build
```

`npm run test:e2e` starts Vite on `http://127.0.0.1:4173` and runs the Chromium navigation,
responsive-layout, keyboard-focus, route-recovery, and Book Delivery isolation checks.

## Deployment

The project uses `@sveltejs/adapter-vercel` with the Node.js 22 runtime. Vercel should install
with `npm ci` and build with `npm run build`. Keep service credentials in Vercel environment
variables, never in client code or committed files.
