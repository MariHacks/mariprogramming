# Google account

Complete a MariTools student profile after Google sign-in.

## Sub-features

- `account-sign-in` — Better Auth Google OAuth.
- `account-complete` — student number (server-side only) + NIM disclosure.

## How to get to it (user POV)

- Header Sign up → `/tools/account`.
- Sign in with Google, enter student number, accept NVIDIA disclosure.

## Driving it with browser MCP

Preconditions: OAuth env vars configured; manual Google sign-in in browser.

- Open `/tools/account` unsigned → guest view with sign-in.
- After OAuth → incomplete profile form.
- Submit valid 5–8 digit student number and disclosure checkbox.
- Completed view shows email and display name only — never student number in HTML.

Proof: screenshot of completed state; `npx vitest run src/routes/tools/account/`.

## Gotchas

- `team@marihacks.com` receives staff role server-side.
- Student number never appears on forum, catalog, or schedule pages.
