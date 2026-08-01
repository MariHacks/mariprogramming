# Book Delivery Commerce and Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Book Delivery catalogue into a secure, operational service with executive catalogue management, full upfront payment, e-transfer handling, order emails, grouped purchasing exports, and pickup at Wayne's Front Desk.

**Architecture:** Supabase supplies Postgres, Storage, and cookie-backed executive authentication. All browser data remains untrusted: SvelteKit server routes resolve active catalogue data, create immutable price snapshots, create Stripe PaymentIntents, verify Stripe webhooks, and control state transitions. Students use guest checkout with an opaque order-access token; only named executives can manage books or fulfillment.

**Tech Stack:** SvelteKit server routes and form actions, Supabase Postgres/Auth/Storage with `@supabase/ssr`, Stripe Payment Element and webhooks, Resend for branded transactional email, Zod validation, Vitest, Playwright.

## Global Constraints

- Keep the approved custom, two-column checkout and use Stripe-hosted secure payment fields. Never collect or store raw card data.
- Card payment receipts are sent by Stripe. Branded service messages cover order confirmation, e-transfer instructions, payment confirmation, and ready-for-pickup notices.
- Guest checkout collects a student name and ID and accepts only a configured Marianopolis student email domain. It does not create a student account.
- The only pickup location is Wayne's Front Desk at Marianopolis College. Show the map and pickup information on review and confirmation only.
- Validate every price, bookstore fee, ID, URL, quantity, authorization decision, and state transition on the server.
- The final cart total is calculated from live server data, never accepted from a browser total.
- One $5-$7 service fee is applied once per distinct bookstore, configured by executives.
- The first release generates bookstore-specific purchase lists for manual buying. It never calls bookstore order APIs.

---

## File Structure

| Path                                                       | Responsibility                                                                    |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `supabase/migrations/202608010001_book_delivery.sql`       | Tables, constraints, indexes, RLS, storage bucket, and public catalogue policies. |
| `supabase/seed.sql`                                        | Non-production fixture data for local and staging testing.                        |
| `src/app.d.ts`                                             | `App.Locals` and environment typing.                                              |
| `src/hooks.server.js`                                      | Cookie-backed Supabase client per request.                                        |
| `src/lib/server/supabase.js`                               | Server and service-role Supabase clients.                                         |
| `src/lib/server/auth.js`                                   | Executive identity and role checks.                                               |
| `src/lib/server/catalogue.js`                              | Read and mutation repository for catalogue data.                                  |
| `src/lib/server/order-pricing.js`                          | Authoritative quote and snapshot creation.                                        |
| `src/lib/server/order-access.js`                           | Opaque guest order-token generation and verification.                             |
| `src/lib/server/order-state.js`                            | Valid payment and fulfillment state transitions.                                  |
| `src/lib/server/validation.js`                             | Shared Zod schemas for forms and URLs.                                            |
| `src/lib/server/stripe.js`                                 | Stripe client and PaymentIntent helpers.                                          |
| `src/lib/server/email.js`                                  | Resend adapter and idempotent email dispatch.                                     |
| `src/lib/books/PickupMap.svelte`                           | Accessible Marianopolis College map and Wayne's Front Desk callout.               |
| `src/lib/books/StripePayment.svelte`                       | Secure Stripe Payment Element wrapper.                                            |
| `src/routes/auth/confirm/+server.js`                       | Magic-link token exchange.                                                        |
| `src/routes/admin/**`                                      | Executive login, catalogue management, order operations, and exports.             |
| `src/routes/books/checkout/**`                             | Guest identity and payment-method choice.                                         |
| `src/routes/books/review/[accessToken]/**`                 | Price-reviewed, map-bearing payment confirmation.                                 |
| `src/routes/books/order/[accessToken]/**`                  | Guest confirmation and order status.                                              |
| `src/routes/api/stripe/payment-intent/+server.js`          | Creates one PaymentIntent for an approved draft.                                  |
| `src/routes/api/stripe/webhook/+server.js`                 | Verifies and handles Stripe events idempotently.                                  |
| `src/routes/api/orders/[accessToken]/etransfer/+server.js` | Places a reviewed e-transfer order.                                               |

## Task 1: Provision the service contract, database schema, and local test data

**Files:**

- Create: `.env.example`
- Create: `supabase/config.toml`
- Create: `supabase/migrations/202608010001_book_delivery.sql`
- Create: `supabase/seed.sql`
- Create: `src/lib/server/order-state.js`
- Create: `src/lib/server/order-state.test.js`
- Modify: `package.json`

**Interfaces:**

- Produces the payment states `draft`, `payment_pending`, `awaiting_transfer`, `paid`, `failed`, `refunded`, and `cancelled`.
- Produces the fulfillment states `unstarted`, `purchased`, `received`, `ready_for_pickup`, `picked_up`, and `cancelled`.
- Produces `canTransition(current, next, transitions): boolean` and `canAdvanceFulfillment(paymentStatus, current, next): boolean` for all later order actions.

- [ ] **Step 1: Install server dependencies and record all required configuration**

Run:

```bash
npm install @supabase/supabase-js @supabase/ssr @stripe/stripe-js stripe resend zod
npm install -D supabase
```

Create `.env.example` with exactly these keys and no real values:

```dotenv
PUBLIC_SITE_URL=http://localhost:5173
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
ORDER_FROM_EMAIL=
ETRANSFER_RECIPIENT_EMAIL=
ETRANSFER_INSTRUCTIONS=
ALLOWED_STUDENT_EMAIL_DOMAINS=marianopolis.edu
```

Add `.env` and `.env.*` except `.env.example` to `.gitignore`.

- [ ] **Step 2: Write failing transition tests**

Create `src/lib/server/order-state.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
	canAdvanceFulfillment,
	canTransition,
	fulfillmentTransitions,
	paymentTransitions
} from './order-state';

describe('order state transitions', () => {
	it('allows a successful card payment to become paid', () => {
		expect(canTransition('payment_pending', 'paid', paymentTransitions)).toBe(true);
	});

	it('does not allow an unpaid transfer to enter purchasing', () => {
		expect(canAdvanceFulfillment('awaiting_transfer', 'unstarted', 'purchased')).toBe(false);
	});

	it('does not let a picked-up order become ready again', () => {
		expect(canTransition('picked_up', 'ready_for_pickup', fulfillmentTransitions)).toBe(false);
	});
});
```

- [ ] **Step 3: Run the focused test and verify it fails**

Run: `npm test -- src/lib/server/order-state.test.js`

Expected: FAIL because `order-state.js` does not exist.

- [ ] **Step 4: Implement state constraints and the initial migration**

Create `src/lib/server/order-state.js`:

```js
export const paymentTransitions = {
	draft: ['payment_pending', 'awaiting_transfer', 'cancelled'],
	payment_pending: ['paid', 'failed', 'cancelled'],
	awaiting_transfer: ['paid', 'cancelled'],
	paid: ['refunded'],
	failed: ['payment_pending', 'cancelled'],
	refunded: [],
	cancelled: []
};

export const fulfillmentTransitions = {
	unstarted: ['purchased', 'cancelled'],
	purchased: ['received', 'cancelled'],
	received: ['ready_for_pickup', 'cancelled'],
	ready_for_pickup: ['picked_up', 'cancelled'],
	picked_up: [],
	cancelled: []
};

export function canTransition(current, next, transitions) {
	return transitions[current]?.includes(next) ?? false;
}

export function canAdvanceFulfillment(paymentStatus, current, next) {
	return paymentStatus === 'paid' && canTransition(current, next, fulfillmentTransitions);
}
```

Start `supabase/migrations/202608010001_book_delivery.sql` with this schema. Add only the listed indexes, policy statements, trigger, and seed references; do not introduce a second order or pricing model.

```sql
create extension if not exists pgcrypto;

create table public.executives (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookstores (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  service_fee_cents integer not null check (service_fee_cents between 500 and 700),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  code text not null,
  title text not null,
  term text not null,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, code, term)
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  bookstore_id uuid not null references public.bookstores(id) on delete restrict,
  title text not null,
  author text not null,
  isbn text,
  edition text,
  format text not null,
  price_cents integer not null check (price_cents >= 0),
  cover_path text,
  retailer_url text check (retailer_url is null or retailer_url ~ '^https?://'),
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.book_delivery_settings (
  id boolean primary key default true check (id),
  tax_rate_bps integer not null check (tax_rate_bps between 0 and 10000),
  ordering_opens_at timestamptz,
  ordering_closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  access_token_hash text not null unique,
  student_name text not null,
  student_email text not null,
  student_id text not null,
  payment_method text not null check (payment_method in ('card', 'etransfer')),
  payment_status text not null default 'draft' check (payment_status in ('draft', 'payment_pending', 'awaiting_transfer', 'paid', 'failed', 'refunded', 'cancelled')),
  fulfillment_status text not null default 'unstarted' check (fulfillment_status in ('unstarted', 'purchased', 'received', 'ready_for_pickup', 'picked_up', 'cancelled')),
  currency char(3) not null default 'cad' check (currency = 'cad'),
  book_subtotal_cents integer not null check (book_subtotal_cents >= 0),
  fee_subtotal_cents integer not null check (fee_subtotal_cents >= 0),
  tax_cents integer not null check (tax_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  stripe_payment_intent_id text unique,
  transfer_memo text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete restrict,
  bookstore_id uuid not null references public.bookstores(id) on delete restrict,
  bookstore_name text not null,
  book_title text not null,
  book_author text not null,
  book_edition text,
  book_format text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (order_id, book_id)
);

create table public.order_fees (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  bookstore_id uuid not null references public.bookstores(id) on delete restrict,
  bookstore_name text not null,
  amount_cents integer not null check (amount_cents between 500 and 700),
  created_at timestamptz not null default now(),
  unique (order_id, bookstore_id)
);

create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  template text not null check (template in ('etransfer_instructions', 'payment_confirmed', 'ready_for_pickup')),
  provider_message_id text,
  sent_at timestamptz not null default now(),
  unique (order_id, template)
);

create table public.stripe_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  event_type text not null,
  received_at timestamptz not null default now()
);

create index courses_teacher_id_idx on public.courses (teacher_id);
create index books_course_id_idx on public.books (course_id);
create index orders_payment_fulfillment_idx on public.orders (payment_status, fulfillment_status);
create index orders_student_lookup_idx on public.orders (student_name, student_email, student_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

create trigger executives_updated_at before update on public.executives for each row execute procedure public.set_updated_at();
create trigger bookstores_updated_at before update on public.bookstores for each row execute procedure public.set_updated_at();
create trigger teachers_updated_at before update on public.teachers for each row execute procedure public.set_updated_at();
create trigger courses_updated_at before update on public.courses for each row execute procedure public.set_updated_at();
create trigger books_updated_at before update on public.books for each row execute procedure public.set_updated_at();
create trigger settings_updated_at before update on public.book_delivery_settings for each row execute procedure public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute procedure public.set_updated_at();
```

Then enable RLS and create only the four public-read policies below. The service-role client bypasses RLS only from server files; no browser mutation policy exists.

```sql
alter table public.executives enable row level security;
alter table public.bookstores enable row level security;
alter table public.teachers enable row level security;
alter table public.courses enable row level security;
alter table public.books enable row level security;
alter table public.book_delivery_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_fees enable row level security;
alter table public.email_events enable row level security;
alter table public.stripe_events enable row level security;

create policy "public reads active bookstores" on public.bookstores for select to anon, authenticated using (active);
create policy "public reads active teachers" on public.teachers for select to anon, authenticated using (active);
create policy "public reads active courses" on public.courses for select to anon, authenticated using (active);
create policy "public reads active books" on public.books for select to anon, authenticated using (active);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-covers', 'book-covers', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
```

Store only `access_token_hash`, never a raw guest-access token. Seed a non-production catalogue with the same teacher, course, bookstore, and book relationships consumed by the catalogue plan.

Enable RLS on every table. Allow anonymous `SELECT` only on active teachers, courses, books, and bookstores. Do not grant anonymous order reads or writes. Create a public `book-covers` storage bucket for published cover images; mutations occur through server-side executive actions only.

Seed a non-production catalogue with the same teacher, course, bookstore, and book relationships consumed by the catalogue plan.

- [ ] **Step 5: Apply schema locally, verify states, and commit**

Run:

```bash
npx supabase start
npx supabase db reset
npm test -- src/lib/server/order-state.test.js
npm run check
npm run lint
```

Expected: Supabase starts, migration and seed apply, tests pass, and no service key appears in output or Git status.

Commit:

```bash
git add .env.example .gitignore package.json package-lock.json supabase src/lib/server/order-state.js src/lib/server/order-state.test.js
git commit -m "feat: add book delivery service schema"
```

## Task 2: Add secure Supabase request clients and executive magic-link access

**Files:**

- Create: `src/app.d.ts`
- Create: `src/hooks.server.js`
- Create: `src/lib/server/supabase.js`
- Create: `src/lib/server/auth.js`
- Create: `src/lib/server/auth.test.js`
- Create: `src/routes/auth/confirm/+server.js`
- Create: `src/routes/admin/login/+page.server.js`
- Create: `src/routes/admin/login/+page.svelte`
- Create: `src/routes/admin/+layout.server.js`

**Interfaces:**

- Produces `event.locals.supabase` using cookie-backed `@supabase/ssr`.
- Produces `requireExecutive(event, isExecutive = lookupExecutive): Promise<{ id: string, email: string }>`.
- Produces a magic-link confirmation endpoint and protected `/admin` layout.

- [ ] **Step 1: Write failing authorization tests**

Create `src/lib/server/auth.test.js`:

```js
import { expect, it } from 'vitest';
import { isAllowedStudentEmail, requireExecutive } from './auth';

it('accepts only configured student email domains', () => {
	expect(isAllowedStudentEmail('student@marianopolis.edu', ['marianopolis.edu'])).toBe(true);
	expect(isAllowedStudentEmail('student@example.com', ['marianopolis.edu'])).toBe(false);
});

it('rejects a user who is not in the executive allowlist', async () => {
	const event = {
		locals: {
			supabase: {
				auth: {
					getUser: async () => ({ data: { user: { id: 'u1', email: 'student@marianopolis.edu' } } })
				}
			}
		}
	};
	await expect(requireExecutive(event, async () => false)).rejects.toMatchObject({ status: 303 });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/lib/server/auth.test.js`

Expected: FAIL because `auth.js` does not exist.

- [ ] **Step 3: Implement trusted-user checks and magic-link flow**

Use `createServerClient` from `@supabase/ssr` in `src/hooks.server.js` and write only the cookie changes provided by the client. In `requireExecutive`, call `event.locals.supabase.auth.getUser()` rather than trusting a decoded session, then use the server-only service client to check for the authenticated `user.id` in `executives`.

Implement:

```js
export function isAllowedStudentEmail(email, allowedDomains) {
	const domain = email.trim().toLowerCase().split('@')[1];
	return Boolean(domain && allowedDomains.includes(domain));
}
```

The admin login action must first verify that the submitted address is an active executive email, then request `signInWithOtp` with `emailRedirectTo: `${PUBLIC_SITE_URL}/auth/confirm``. `/auth/confirm`exchanges`token_hash`for a cookie session and redirects to`/admin`; a failed exchange redirects to `/admin/login?error=invalid-link`. The protected layout redirects unauthenticated and non-executive requests to `/admin/login`.

- [ ] **Step 4: Verify authorization behavior and Supabase SSR configuration**

Run:

```bash
npm test -- src/lib/server/auth.test.js
npm run check
npm run lint
```

With local Supabase running, create one executive row, request a magic link for that user, and confirm the callback reaches `/admin`. Repeat with a non-executive email and confirm no magic link is sent.

- [ ] **Step 5: Commit the access layer**

```bash
git add src/app.d.ts src/hooks.server.js src/lib/server/supabase.js src/lib/server/auth.js src/lib/server/auth.test.js src/routes/auth src/routes/admin/login src/routes/admin/+layout.server.js
git commit -m "feat: secure executive access"
```

## Task 3: Replace fixture catalogue data with executive-managed Supabase data

**Files:**

- Create: `src/lib/server/validation.js`
- Create: `src/lib/server/catalogue.js`
- Create: `src/lib/server/catalogue.test.js`
- Create: `src/routes/admin/+page.svelte`
- Create: `src/routes/admin/catalogue/+page.server.js`
- Create: `src/routes/admin/catalogue/+page.svelte`
- Create: `src/routes/admin/catalogue/books/[bookId]/+page.server.js`
- Create: `src/routes/admin/catalogue/books/[bookId]/+page.svelte`
- Create: `src/routes/books/+page.server.js`
- Create: `src/routes/books/[teacherSlug]/+page.server.js`
- Delete: `src/routes/books/+page.js`
- Delete: `src/routes/books/[teacherSlug]/+page.js`
- Modify: `src/lib/books/catalogue.js`

**Interfaces:**

- Produces `bookSchema`, `bookstoreSchema`, and `validateStorefrontUrl(value)`.
- Produces `listPublicTeachers()`, `getPublicTeacherBySlug(slug)`, `saveBook(input)`, and `uploadBookCover(file, bookId)`.
- Replaces local fixture reads in public load functions with serializable repository results.

- [ ] **Step 1: Write failing validation and repository tests**

Create `src/lib/server/catalogue.test.js`:

```js
import { expect, it } from 'vitest';
import { validateStorefrontUrl } from './validation';

it('accepts an HTTPS bookstore product URL', () => {
	expect(validateStorefrontUrl('https://www.renaud-bray.com/book')).toBe(
		'https://www.renaud-bray.com/book'
	);
});

it('rejects a javascript URL', () => {
	expect(() => validateStorefrontUrl('javascript:alert(1)')).toThrow(/http or https/i);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npm test -- src/lib/server/catalogue.test.js`

Expected: FAIL because the validation module does not exist.

- [ ] **Step 3: Implement explicit admin forms and public read repository**

Use Zod to enforce a book input shape:

```js
{
	title: z.string().trim().min(1).max(200),
	author: z.string().trim().min(1).max(160),
	format: z.string().trim().min(1).max(80),
	priceCents: z.coerce.number().int().min(0),
	bookstoreId: z.string().uuid(),
	courseId: z.string().uuid(),
	storefrontUrl: z.string().trim().optional()
}
```

`validateStorefrontUrl` returns `null` for an empty string, otherwise requires an `http:` or `https:` URL parsed by `new URL(value)`. Preserve the canonical `URL.href` value.

The admin catalogue page lists teachers, courses, bookstore fees, and books. The book edit form permits title, author, ISBN, edition, format, price in cents or dollars converted server-side, course, bookstore, active state, retailer URL, and cover upload. `uploadBookCover` accepts only `image/jpeg`, `image/png`, and `image/webp`, max 2 MB, generates a storage path `{bookId}/{crypto.randomUUID()}.{extension}`, and stores only the resulting object path in the database.

Public loaders use only active rows and return `storefrontUrl: null` when no verified URL exists. Replace `src/routes/books/+page.js` and `src/routes/books/[teacherSlug]/+page.js` with server-only load files of the same route names ending in `.server.js`, so repository imports cannot be bundled for the browser. Remove the development fixture from production reads but keep its pure helper tests where still useful.

- [ ] **Step 4: Verify public catalogue and privileged mutations**

Run:

```bash
npm test -- src/lib/server/catalogue.test.js src/lib/books/cart.test.js
npm run check
npm run lint
```

Manual check: anonymous `/books` shows only active records; a logged-in executive can add a book with a valid retailer link and cover; a malformed link or oversized non-image upload gives a field-level error; an anonymous POST is rejected.

- [ ] **Step 5: Commit catalogue management**

```bash
git add src/lib/server/validation.js src/lib/server/catalogue.js src/lib/server/catalogue.test.js src/routes/admin src/routes/books/+page.server.js src/routes/books/[teacherSlug]/+page.server.js src/lib/books/catalogue.js
git rm src/routes/books/+page.js src/routes/books/[teacherSlug]/+page.js
git commit -m "feat: add executive book catalogue management"
```

## Task 4: Create guest order drafts and authoritative price snapshots

**Files:**

- Create: `src/lib/server/order-pricing.js`
- Create: `src/lib/server/order-pricing.test.js`
- Create: `src/lib/server/order-access.js`
- Create: `src/lib/server/order-access.test.js`
- Create: `src/routes/books/checkout/+page.server.js`
- Create: `src/routes/books/checkout/+page.svelte`
- Create: `src/routes/books/review/[accessToken]/+page.server.js`
- Create: `src/routes/books/review/[accessToken]/+page.svelte`
- Create: `src/lib/books/PickupMap.svelte`

**Interfaces:**

- Produces `quoteOrder(catalogue, cart): OrderQuote` using current database values.
- Produces `createOrderAccessToken(): { token: string, hash: string }` and `hashOrderAccessToken(token): string`.
- Produces a persisted draft with ordered-item and fee snapshots before any payment interaction.

- [ ] **Step 1: Write failing authoritative-quote and token tests**

Create `src/lib/server/order-pricing.test.js`:

```js
import { expect, it } from 'vitest';
import { quoteOrder } from './order-pricing';

it('ignores a forged browser price and uses the catalogue price', () => {
	const quote = quoteOrder(
		{
			taxRateBps: 1498,
			bookstores: [{ id: 'b1', serviceFeeCents: 500 }],
			books: [{ id: 'book-1', title: 'Book', priceCents: 2500, bookstoreId: 'b1' }]
		},
		{ items: [{ bookId: 'book-1', quantity: 1, priceCents: 1 }] }
	);
	expect(quote.bookSubtotalCents).toBe(2500);
});
```

Create `src/lib/server/order-access.test.js`:

```js
import { expect, it } from 'vitest';
import { createOrderAccessToken, hashOrderAccessToken } from './order-access';

it('creates an opaque token whose stored hash does not equal the token', () => {
	const { token, hash } = createOrderAccessToken();
	expect(token).not.toBe(hash);
	expect(hashOrderAccessToken(token)).toBe(hash);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npm test -- src/lib/server/order-pricing.test.js src/lib/server/order-access.test.js`

Expected: FAIL because the server pricing and access modules do not exist.

- [ ] **Step 3: Implement server quote, draft persistence, review, and map**

`quoteOrder` must accept only `{ bookId, quantity }` browser fields, load active books and bookstores from the repository, reject an empty cart and unknown IDs, apply each current fee once, use the configured tax rate, and return immutable line snapshots. It must never inspect a browser-provided price, name, fee, or tax value.

Use `crypto.randomBytes(32).toString('base64url')` for the opaque token and SHA-256 for the stored hash. A review action validates a non-empty student name, email, and student ID, checks `isAllowedStudentEmail`, persists those three identifying fields with the draft and its snapshot rows, then redirects to `/books/review/{token}`. The raw token exists only in the redirect URL and outgoing order email, not database logs.

The checkout form uses labels exactly `Student name`, `Marianopolis email`, `Student ID`, `Payment method: card`, and `Payment method: e-transfer`. Its submit button is named `Review order`. The visual layout is the approved two-column design: identity and payment choice on Paper at left, live order summary on Midnight at right. The review page is the first book-flow page that renders pickup content.

`PickupMap.svelte` is rendered only on review and confirmation. It must include a visible map embed centered on Marianopolis College, a text heading `Pickup at Wayne's Front Desk`, a textual campus address or directions link, and an iframe `title="Map to Marianopolis College"`. It must not use student location or tracking.

- [ ] **Step 4: Verify server repricing and review authorization**

Run:

```bash
npm test -- src/lib/server/order-pricing.test.js src/lib/server/order-access.test.js
npm run check
npm run lint
```

Manual check: edit an item price in browser developer tools, submit review, and confirm the server draft uses the database amount. Request a review page with a random token and confirm it returns 404 without exposing an order.

- [ ] **Step 5: Commit guest review flow**

```bash
git add src/lib/server/order-pricing.js src/lib/server/order-pricing.test.js src/lib/server/order-access.js src/lib/server/order-access.test.js src/routes/books/checkout src/routes/books/review src/lib/books/PickupMap.svelte
git commit -m "feat: add reviewed guest book orders"
```

## Task 5: Integrate Stripe Payment Element and verified webhook payment updates

**Files:**

- Create: `src/lib/server/stripe.js`
- Create: `src/lib/server/stripe.test.js`
- Create: `src/lib/books/StripePayment.svelte`
- Create: `src/routes/api/stripe/payment-intent/+server.js`
- Create: `src/routes/api/stripe/webhook/+server.js`
- Create: `src/routes/books/order/[accessToken]/+page.server.js`
- Create: `src/routes/books/order/[accessToken]/+page.svelte`
- Modify: `src/routes/books/review/[accessToken]/+page.svelte`

**Interfaces:**

- Produces `createPaymentIntentForDraft(order)` and `handleStripeEvent(event)`.
- Produces `StripePayment` props `{ clientSecret, orderToken, amountCents, onSuccess, onError }`.
- PaymentIntent metadata contains only `orderId` and `orderNumber`.

- [ ] **Step 1: Write failing Stripe helper tests**

Create `src/lib/server/stripe.test.js`:

```js
import { expect, it, vi } from 'vitest';
import { createPaymentIntentForDraft } from './stripe';

it('creates a CAD PaymentIntent from the persisted draft total and receipt email', async () => {
	const stripe = {
		paymentIntents: { create: vi.fn().mockResolvedValue({ id: 'pi_123', client_secret: 'secret' }) }
	};
	await createPaymentIntentForDraft(stripe, {
		id: 'order-1',
		orderNumber: 'MARI-1001',
		totalCents: 6197,
		studentEmail: 'student@marianopolis.edu'
	});
	expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
		expect.objectContaining({
			amount: 6197,
			currency: 'cad',
			receipt_email: 'student@marianopolis.edu'
		})
	);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/lib/server/stripe.test.js`

Expected: FAIL because the Stripe helper does not exist.

- [ ] **Step 3: Implement secure payment creation, element mounting, and webhook idempotency**

`createPaymentIntentForDraft` must reject drafts whose payment status is not `draft` or `payment_pending`, use `amount: order.totalCents`, `currency: 'cad'`, `receipt_email: order.studentEmail`, `metadata: { orderId: order.id, orderNumber: order.orderNumber }`, and `automatic_payment_methods: { enabled: true }`. Persist the returned PaymentIntent ID before returning the client secret.

`StripePayment.svelte` loads Stripe only from `@stripe/stripe-js`, mounts a Payment Element with the approved light-panel appearance, and calls `stripe.confirmPayment({ elements, confirmParams: { return_url: `${window.location.origin}/books/order/${orderToken}` } })`. It never sends card data to a SvelteKit endpoint.

The webhook route reads `await request.text()` before parsing, verifies `stripe-signature` with `stripe.webhooks.constructEvent`, inserts the event ID in `stripe_events` under a unique constraint, and ignores an already-seen event. For `payment_intent.succeeded`, it moves payment from `payment_pending` to `paid`, then triggers the idempotent branded confirmation email. For `payment_intent.payment_failed`, it moves the payment to `failed` without marking fulfillment eligible.

- [ ] **Step 4: Verify card success, failure, and duplicate-webhook handling**

Run:

```bash
npm test -- src/lib/server/stripe.test.js src/lib/server/order-state.test.js
npm run check
npm run lint
```

Use Stripe CLI to forward test webhooks, then run:

```bash
stripe trigger payment_intent.succeeded
```

Expected: one order becomes `paid`, one confirmation email event is recorded, and replaying the same webhook does not duplicate either change. Verify a declined test card leaves fulfillment `unstarted`.

- [ ] **Step 5: Commit card payment**

```bash
git add src/lib/server/stripe.js src/lib/server/stripe.test.js src/lib/books/StripePayment.svelte src/routes/api/stripe src/routes/books/review/[accessToken]/+page.svelte src/routes/books/order
git commit -m "feat: accept book orders with Stripe"
```

## Task 6: Implement e-transfer and branded transactional email paths

**Files:**

- Create: `src/lib/server/email.js`
- Create: `src/lib/server/email.test.js`
- Create: `src/routes/api/orders/[accessToken]/etransfer/+server.js`
- Modify: `src/routes/books/review/[accessToken]/+page.svelte`
- Modify: `src/routes/books/order/[accessToken]/+page.svelte`

**Interfaces:**

- Produces `sendOrderEmail({ order, template, resend })` and idempotent email-event records.
- Produces `placeEtransferOrder(accessToken)` that moves only a draft to `awaiting_transfer`.

- [ ] **Step 1: Write failing e-transfer email tests**

Create `src/lib/server/email.test.js`:

```js
import { expect, it, vi } from 'vitest';
import { buildEtransferEmail, sendOrderEmail } from './email';

it('includes the exact transfer amount and unique memo', () => {
	const email = buildEtransferEmail({
		orderNumber: 'MARI-1001',
		totalCents: 6197,
		transferMemo: 'MARI-1001'
	});
	expect(email.text).toMatch(/\$61\.97/);
	expect(email.text).toMatch(/MARI-1001/);
});

it('does not send an already-recorded email template twice', async () => {
	const resend = { emails: { send: vi.fn() } };
	const result = await sendOrderEmail({
		alreadySent: true,
		resend,
		order: {},
		template: 'confirmation'
	});
	expect(result).toEqual({ skipped: true });
	expect(resend.emails.send).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/lib/server/email.test.js`

Expected: FAIL because `email.js` does not exist.

- [ ] **Step 3: Implement transactional templates and e-transfer placement**

`email.js` must define templates `etransfer_instructions`, `payment_confirmed`, and `ready_for_pickup`. Each uses an order number, final item and fee summary, guest order link, and plain-text alternative. It must send via `resend.emails.send({ from: ORDER_FROM_EMAIL, to: order.studentEmail, subject, html, text })` and create an `email_events` row after a successful send. A unique `(order_id, template)` constraint or equivalent transaction prevents duplicate sends.

The e-transfer route verifies the opaque access token, loads the current draft, atomically moves `draft` to `awaiting_transfer`, assigns `transfer_memo = order_number`, and sends the instruction email. It returns the order URL only after state persistence. Review UI exposes this action only when the selected payment method is e-transfer; it must never claim transfer payment has already been received.

- [ ] **Step 4: Verify e-transfer behavior and email safety**

Run:

```bash
npm test -- src/lib/server/email.test.js src/lib/server/order-state.test.js
npm run check
npm run lint
```

Use a Resend sandbox recipient to submit a transfer order. Confirm the email has the exact amount, recipient instructions, unique memo, order link, and no card receipt claim. Submit the route again and confirm state or email is not duplicated.

- [ ] **Step 5: Commit e-transfer and email support**

```bash
git add src/lib/server/email.js src/lib/server/email.test.js src/routes/api/orders src/routes/books/review/[accessToken]/+page.svelte src/routes/books/order/[accessToken]/+page.svelte
git commit -m "feat: add e-transfer order emails"
```

## Task 7: Build executive fulfillment, storefront exports, and pickup actions

**Files:**

- Create: `src/routes/admin/orders/+page.server.js`
- Create: `src/routes/admin/orders/+page.svelte`
- Create: `src/routes/admin/orders/[orderId]/+page.server.js`
- Create: `src/routes/admin/orders/[orderId]/+page.svelte`
- Create: `src/routes/admin/exports/bookstores.csv/+server.js`
- Create: `src/lib/server/csv.js`
- Create: `src/lib/server/csv.test.js`
- Modify: `src/lib/server/order-state.js`
- Modify: `src/lib/server/email.js`

**Interfaces:**

- Produces `escapeCsvCell(value): string`, `buildBookstorePurchaseRows(orderItems)`, and a paid-order export grouped by bookstore and book snapshot.
- Produces admin-only actions `confirmTransfer`, `advanceFulfillment`, and `markPickedUp` that use the transition maps.

- [ ] **Step 1: Write failing CSV escaping tests**

Create `src/lib/server/csv.test.js`:

```js
import { expect, it } from 'vitest';
import { buildBookstorePurchaseRows, escapeCsvCell } from './csv';

it('quotes commas, quotes, and newlines in spreadsheet values', () => {
	expect(escapeCsvCell('Doe, "Jane"\nStudent')).toBe('"Doe, ""Jane""\nStudent"');
});

it('prevents spreadsheet formula interpretation', () => {
	expect(escapeCsvCell('=HYPERLINK("https://bad.example")')).toMatch(/^'/);
});

it('aggregates purchase quantities without exporting student data', () => {
	const rows = buildBookstorePurchaseRows([
		{
			bookstoreName: 'Renaud-Bray',
			bookTitle: 'Antigone',
			bookEdition: null,
			bookFormat: 'Paperback',
			quantity: 1,
			studentId: '111'
		},
		{
			bookstoreName: 'Renaud-Bray',
			bookTitle: 'Antigone',
			bookEdition: null,
			bookFormat: 'Paperback',
			quantity: 2,
			studentId: '222'
		}
	]);
	expect(rows).toEqual([
		{ bookstore: 'Renaud-Bray', title: 'Antigone', edition: '', format: 'Paperback', quantity: 3 }
	]);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/lib/server/csv.test.js`

Expected: FAIL because `csv.js` does not exist.

- [ ] **Step 3: Implement operations dashboard and guarded transition actions**

The orders page filters by payment and fulfillment status and searches order number, student name or email, and student ID. It never exposes an order list publicly. The detail page displays price snapshot, retailer/store split, payment state, fulfillment state, and email-event history.

Implement exact transition guards:

```text
awaiting_transfer -> paid       only through confirmTransfer
paid + unstarted -> purchased   only through advanceFulfillment
purchased -> received           only through advanceFulfillment
received -> ready_for_pickup    only through advanceFulfillment and sends ready_for_pickup email
ready_for_pickup -> picked_up   only through markPickedUp
```

All actions call `requireExecutive`, load the current row in the same transaction, call `canTransition` for payment updates and `canAdvanceFulfillment` for fulfillment updates, and return a clear form error when the requested transition is invalid.

The CSV route calls `requireExecutive`, includes only `payment_status = 'paid'` and `fulfillment_status = 'unstarted'`, and groups item snapshots by bookstore, title, edition, and format. It returns only `bookstore`, `title`, `edition`, `format`, and aggregated `quantity`; a bookstore purchasing list must not expose student names, emails, IDs, or order tokens. Use `Content-Disposition: attachment; filename="bookstore-orders.csv"`.

- [ ] **Step 4: Verify exports, status rules, and pickup email**

Run:

```bash
npm test -- src/lib/server/csv.test.js src/lib/server/order-state.test.js src/lib/server/email.test.js
npm run check
npm run lint
```

Manual check: unauthenticated `/admin/orders` redirects; a paid order appears in export; an awaiting-transfer order does not; set one received order ready for pickup and confirm one email is sent; mark it picked up and verify it cannot move backward.

- [ ] **Step 5: Commit fulfillment tooling**

```bash
git add src/routes/admin/orders src/routes/admin/exports src/lib/server/csv.js src/lib/server/csv.test.js src/lib/server/order-state.js src/lib/server/email.js
git commit -m "feat: add book delivery fulfillment tools"
```

## Task 8: Finish end-to-end verification, environment setup, and operational documentation

**Files:**

- Create: `tests/e2e/book-checkout.spec.js`
- Create: `docs/book-delivery-operations.md`
- Modify: `README.md`
- Create: `.github/workflows/quality.yml`

**Interfaces:**

- Consumes: the implemented staging services and safe test keys.
- Produces: a documented launch checklist and end-to-end coverage for card, e-transfer, guest access, and pickup-map behavior.

- [ ] **Step 1: Write a failing browser flow test using safe test data**

Create `tests/e2e/book-checkout.spec.js`:

```js
import { expect, test } from '@playwright/test';

test('review includes the pickup map only after checkout begins', async ({ page }) => {
	await page.goto('/books/mme-tremblay');
	await expect(page.getByTitle('Map to Marianopolis College')).toHaveCount(0);
	await page.getByRole('button', { name: /add selected books to cart/i }).click();
	await page.goto('/books/checkout');
	await page.getByLabel('Student name').fill('Staging Student');
	await page.getByLabel('Marianopolis email').fill('student@marianopolis.edu');
	await page.getByLabel('Student ID').fill('99999999');
	await page.getByLabel('Payment method: e-transfer').check();
	await page.getByRole('button', { name: 'Review order' }).click();
	await expect(page.getByTitle('Map to Marianopolis College')).toHaveCount(1);
	await expect(page.getByText(/Wayne's Front Desk/i)).toBeVisible();
});
```

Use an e-transfer test path for deterministic browser coverage. Card confirmation is verified through Stripe test mode and webhook tests rather than hard-coding a card number into the browser test.

- [ ] **Step 2: Run the new test and verify it fails before the staging flow is configured**

Run: `npm run test:e2e -- tests/e2e/book-checkout.spec.js`

Expected: FAIL until a staging Supabase project, allowed staging student domain, and test fixture are configured. Do not change the test to skip the real review route.

- [ ] **Step 3: Configure staging and write the operational runbook**

Set Vercel preview and production environment variables from `.env.example`; never commit them. Configure Supabase Auth redirect URLs for local, preview, and production hostnames. Configure the Stripe webhook endpoint `/api/stripe/webhook`, enable successful-payment receipts and branding, and configure Resend sender-domain verification.

Create `docs/book-delivery-operations.md` with these exact operational sections:

```text
Before an ordering window opens
Catalogue and retailer-link verification
Card and e-transfer reconciliation
Manual bookstore purchasing export
Receiving and pickup workflow
Refund and cancellation handling
Student-data retention and export deletion
Incident response for an incorrect price or unavailable book
```

State the required human decision before production: the actual authorized student-email domains, e-transfer recipient account, tax configuration, refund authority, and pickup schedule.

- [ ] **Step 4: Add CI and run the full verification matrix**

Create `.github/workflows/quality.yml` for pull requests and pushes to `main`. It must run `npm ci`, `npm run check`, `npm run lint`, `npm test`, and `npm run build`; it must not require production secrets. Run locally:

```bash
npm run check
npm run lint
npm test
npm run test:e2e
npm run build
```

Expected: all commands pass against staging-safe configuration. Confirm a student cannot retrieve another order by guessing an order number or random token.

- [ ] **Step 5: Commit launch readiness documentation and checks**

```bash
git add tests/e2e/book-checkout.spec.js docs/book-delivery-operations.md README.md .github/workflows/quality.yml
git commit -m "docs: add book delivery launch runbook"
```

## Plan self-review

- Spec coverage: Supabase database/auth/storage, protected admin catalogue, cover uploads, optional retailer links, configured $5-$7 fees, guest checkout, allowed school domains, order snapshots, Stripe receipts, e-transfer instructions, review and confirmation map, manual bookstore exports, fulfillment transitions, pickup, privacy, and release verification map to Tasks 1-8.
- Security coverage: server-only secrets, RLS, verified `getUser`, admin allowlist, Zod validation, safe URLs, opaque order access tokens, raw-body webhook signature verification, idempotent event and email handling, forged-price rejection, and state-transition checks have explicit tasks and tests.
- Type consistency: the status strings in Task 1 are the only strings used by pricing, Stripe, e-transfer, email, and admin tasks; quote summaries come from `quoteOrder`; all guest pages accept an opaque `accessToken` rather than an order ID.
