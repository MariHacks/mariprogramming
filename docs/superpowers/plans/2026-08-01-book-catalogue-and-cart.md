# Book Delivery Catalogue and Cart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the teacher-first Book Delivery catalogue, selectable course-book lists, retailer links, and a persistent cart that calculates transparent bookstore fees before secure checkout is connected.

**Architecture:** This plan creates a fully interactive client-side catalogue against a deliberately shaped local fixture. Pure cart and price helpers drive the UI and receive thorough unit coverage; Svelte components own only display and interaction. The later commerce plan replaces the fixture with server-loaded data and repeats the final price calculation on the server without changing the public component contracts.

**Tech Stack:** SvelteKit, Svelte stores, Vitest, Testing Library for Svelte, plain CSS, local browser storage, existing design tokens.

## Global Constraints

- The cart control and cart state are visible only under `/books` routes.
- Teacher cards use offset stacked covers as the visual signature; book rows show a cover thumbnail on the left.
- Preset course books start selected in the teacher-detail draft. A student can unselect individual books before explicitly adding the selection to the cart.
- Do not display pickup details on the catalogue or teacher-detail pages.
- Retailer product links are optional and must be omitted when unverified; rendered links open in a new tab with `rel="noreferrer"`.
- All prices use integer Canadian cents. Client totals are optimistic only and will be re-priced on the server before payment in the commerce plan.
- One fee applies per unique bookstore, not per book.

---

## File Structure

| Path                                          | Responsibility                                            |
| --------------------------------------------- | --------------------------------------------------------- |
| `src/lib/books/catalogue.js`                  | Local development fixture and read-only lookup helpers.   |
| `src/lib/books/cart.js`                       | Pure cart mutation and price-summary functions.           |
| `src/lib/books/cart-store.js`                 | Browser-persistent Svelte cart store.                     |
| `src/lib/books/BookCover.svelte`              | Uploaded-image or generated fallback cover.               |
| `src/lib/books/BookCoverStack.svelte`         | Offset stacked-cover teacher-card visual.                 |
| `src/lib/books/TeacherCard.svelte`            | Single accessible link to one teacher's courses.          |
| `src/lib/books/BookRow.svelte`                | Selection, quantity, cover, price, and retailer-link row. |
| `src/lib/books/BookDeliveryBar.svelte`        | Book-only local navigation and cart count.                |
| `src/lib/books/BookstoreCartGroup.svelte`     | Cart group, fee explanation, and removable book lines.    |
| `src/lib/books/CartTotals.svelte`             | Reusable subtotal, tax, fee, and total display.           |
| `src/routes/books/+layout.svelte`             | Creates the cart context and renders `BookDeliveryBar`.   |
| `src/routes/books/+page.js`                   | Supplies teacher summaries from the fixture.              |
| `src/routes/books/+page.svelte`               | Teacher catalogue.                                        |
| `src/routes/books/[teacherSlug]/+page.js`     | Resolves a teacher or returns 404.                        |
| `src/routes/books/[teacherSlug]/+page.svelte` | Course-grouped selectable detail view.                    |
| `src/routes/books/cart/+page.svelte`          | Cart and checkout handoff.                                |

## Task 1: Define the fixture contract and pure price calculation

**Files:**

- Create: `src/lib/books/catalogue.js`
- Create: `src/lib/books/catalogue.test.js`
- Create: `src/lib/books/cart.js`
- Create: `src/lib/books/cart.test.js`

**Interfaces:**

- Produces: `catalogue`, `getTeacherBySlug(slug)`, and `getTeacherBooks(teacherId)`.
- Produces: `createCart(itemsOrBookIds)`, `addBooks(cart, selections)`, `setBookSelected(cart, bookId, selected)`, `setBookQuantity(cart, bookId, quantity)`, and `calculateCart(catalogue, cart)`.
- `calculateCart` returns `{ bookSubtotalCents, taxCents, fees, totalCents, lines }`, where every fee has `{ bookstoreId, label, amountCents }`.

- [ ] **Step 1: Write failing calculation tests that encode the fee rule**

Create `src/lib/books/cart.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { calculateCart, createCart, setBookQuantity, setBookSelected } from './cart';

const fixture = {
	taxRateBps: 1498,
	bookstores: [
		{ id: 'renaud-bray', name: 'Renaud-Bray', serviceFeeCents: 500 },
		{ id: 'archambault', name: 'Archambault', serviceFeeCents: 700 }
	],
	books: [
		{
			id: 'le-petit-prince',
			title: 'Le Petit Prince',
			priceCents: 1895,
			bookstoreId: 'renaud-bray'
		},
		{ id: 'bescherelle', title: 'Bescherelle', priceCents: 2995, bookstoreId: 'renaud-bray' },
		{ id: 'antigone', title: 'Antigone', priceCents: 1695, bookstoreId: 'archambault' }
	]
};

describe('calculateCart', () => {
	it('charges one service fee for two books from the same bookstore', () => {
		const result = calculateCart(fixture, {
			items: [
				{ bookId: 'le-petit-prince', quantity: 1 },
				{ bookId: 'bescherelle', quantity: 1 }
			]
		});
		expect(result.bookSubtotalCents).toBe(4890);
		expect(result.fees).toEqual([
			{ bookstoreId: 'renaud-bray', label: 'Renaud-Bray pickup service', amountCents: 500 }
		]);
	});

	it('removes a line when a selected book is unselected', () => {
		const cart = setBookSelected(createCart(['antigone']), 'antigone', false);
		expect(cart.items).toEqual([]);
	});

	it('clamps quantity to one when a student lowers it below one', () => {
		const cart = setBookQuantity(createCart(['antigone']), 'antigone', 0);
		expect(cart.items).toEqual([]);
	});
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npm test -- src/lib/books/cart.test.js src/lib/books/catalogue.test.js`

Expected: FAIL because the book domain modules do not exist.

- [ ] **Step 3: Implement the compact fixture and deterministic helpers**

Create `catalogue.js` with at least two teachers, three courses, two bookstores, and four books. `Mme Tremblay` must own `French 101` and `French 102`; `Le Petit Prince`, `Bescherelle`, and `Antigone` must belong to those courses so the later browser test has stable data. Use illustrative book names and generated `coverTheme` values until executives upload legitimate covers in the admin plan. Every book object must include this shape:

```js
{
	id: 'le-petit-prince',
	courseId: 'french-101',
	title: 'Le Petit Prince',
	author: 'Antoine de Saint-Exupéry',
	format: 'Paperback',
	priceCents: 1895,
	bookstoreId: 'renaud-bray',
	storefrontUrl: null,
	coverUrl: null,
	coverTheme: 'coral'
}
```

Implement cart mutations immutably. `addBooks(cart, selections)` accepts either IDs or `{ bookId, quantity }` selections and merges quantities by book ID. `setBookQuantity` must remove a line at zero or lower, otherwise set an integer quantity. `calculateCart` must reject unknown book and bookstore IDs by throwing an `Error`, group lines by `bookstoreId`, use `Math.round((bookSubtotalCents + feeSubtotalCents) * taxRateBps / 10000)`, and derive the total from the component parts.

- [ ] **Step 4: Verify calculation behavior and formatting compatibility**

Run:

```bash
npm test -- src/lib/books/cart.test.js src/lib/books/catalogue.test.js src/lib/format.test.js
npm run check
npm run lint
```

Expected: tests and quality checks pass. The seed `storefrontUrl` is `null` until an administrator supplies a verified retailer URL.

- [ ] **Step 5: Commit the book-domain foundation**

```bash
git add src/lib/books/catalogue.js src/lib/books/catalogue.test.js src/lib/books/cart.js src/lib/books/cart.test.js
git commit -m "feat: add book catalogue and cart calculations"
```

## Task 2: Add a browser-persistent cart store without SSR leakage

**Files:**

- Create: `src/lib/books/cart-store.js`
- Create: `src/lib/books/cart-store.test.js`

**Interfaces:**

- Consumes: pure helpers from `src/lib/books/cart.js`.
- Produces: `createBookCartStore(storageKey = 'mari-book-cart')` with `subscribe`, `addBooks(selections)`, `setSelected`, `setQuantity`, `clear`, and `hydrate` methods.

- [ ] **Step 1: Write a failing persistence test**

Create `src/lib/books/cart-store.test.js`:

```js
import { get } from 'svelte/store';
import { expect, it, vi } from 'vitest';
import { createBookCartStore } from './cart-store';

it('hydrates valid saved items and discards malformed storage', () => {
	const storage = {
		getItem: vi.fn().mockReturnValue('{"items":[{"bookId":"antigone","quantity":1}]}'),
		setItem: vi.fn()
	};
	const store = createBookCartStore('test-cart', storage);
	store.hydrate();
	expect(get(store).items).toEqual([{ bookId: 'antigone', quantity: 1 }]);
});
```

- [ ] **Step 2: Run the focused store test and verify it fails**

Run: `npm test -- src/lib/books/cart-store.test.js`

Expected: FAIL because `cart-store.js` does not exist.

- [ ] **Step 3: Implement the injected-storage store**

Use Svelte's `writable` and inject storage so tests do not touch global browser state:

```js
export function createBookCartStore(
	storageKey = 'mari-book-cart',
	storage = globalThis.localStorage
) {
	const { subscribe, set, update } = writable(createCart());
	function persist(cart) {
		storage?.setItem(storageKey, JSON.stringify(cart));
		return cart;
	}
	return { subscribe, hydrate, addBooks, setSelected, setQuantity, clear };
}
```

Guard `globalThis.localStorage` with `typeof window === 'undefined'` so the store can be imported during server rendering. `hydrate` must catch JSON parse errors, reset to `createCart()`, and replace malformed entries rather than throwing.

- [ ] **Step 4: Verify persistence and SSR-safe import behavior**

Run:

```bash
npm test -- src/lib/books/cart-store.test.js
npm run check
npm run lint
```

Expected: all commands pass. Add a test that `clear()` writes `{"items":[]}` and does not leave stale cart lines.

- [ ] **Step 5: Commit the cart store**

```bash
git add src/lib/books/cart-store.js src/lib/books/cart-store.test.js
git commit -m "feat: persist book cart in the browser"
```

## Task 3: Build book visual primitives and teacher catalogue cards

**Files:**

- Create: `src/lib/books/BookCover.svelte`
- Create: `src/lib/books/BookCoverStack.svelte`
- Create: `src/lib/books/TeacherCard.svelte`
- Create: `src/lib/books/TeacherCard.test.js`
- Create: `src/routes/books/+page.js`
- Create: `src/routes/books/+page.svelte`
- Modify: `src/styles.css`

**Interfaces:**

- Consumes: `catalogue`, `getTeacherBooks`, and existing site tokens.
- Produces: a teacher card link named for the teacher and all associated courses.

- [ ] **Step 1: Write a failing teacher-card accessibility test**

Create `src/lib/books/TeacherCard.test.js`:

```js
import { render, screen } from '@testing-library/svelte';
import { expect, it } from 'vitest';
import TeacherCard from './TeacherCard.svelte';

it('uses one link for a teacher card and describes its course bundle', () => {
	render(TeacherCard, {
		props: {
			teacher: { name: 'Mme Tremblay', slug: 'mme-tremblay' },
			courses: [{ title: 'French 101' }],
			books: [
				{
					id: 'le-petit-prince',
					title: 'Le Petit Prince',
					coverUrl: null,
					coverTheme: 'coral',
					priceCents: 1895,
					bookstoreId: 'renaud-bray'
				}
			]
		}
	});
	expect(screen.getByRole('link', { name: /mme tremblay.*french 101/i })).toHaveAttribute(
		'href',
		'/books/mme-tremblay'
	);
});
```

- [ ] **Step 2: Run the card test and verify it fails**

Run: `npm test -- src/lib/books/TeacherCard.test.js`

Expected: FAIL because `TeacherCard.svelte` does not exist.

- [ ] **Step 3: Implement covers, stacks, and the catalogue page**

`BookCover.svelte` accepts `title`, `src`, `theme`, and `size`. When `src` exists, render:

```svelte
<img {src} alt={`Cover of ${title}`} loading="lazy" />
```

When `src` is absent, render a visible generated cover with the title and `aria-label={`Cover placeholder for ${title}`}`. `BookCoverStack` must show at most three covers, offset by CSS transforms, and mark purely decorative duplicate layers as `aria-hidden="true"`.

`TeacherCard` shows the stack, teacher name, course names, book count, calculated minimum bundle price, and number of bookstores. Use a single anchor to `/books/{teacher.slug}`. `+page.js` returns a serializable list of teacher summaries; `+page.svelte` renders heading `Book Delivery`, explanatory copy, and the card grid.

- [ ] **Step 4: Verify the card, route, and image fallbacks**

Run:

```bash
npm test -- src/lib/books/TeacherCard.test.js
npm run check
npm run lint
npm run build
```

Expected: all commands pass. Inspect `/books` at 375px and 1440px; cards remain readable and cover stacks never clip important card copy.

- [ ] **Step 5: Commit the teacher catalogue**

```bash
git add src/lib/books/BookCover.svelte src/lib/books/BookCoverStack.svelte src/lib/books/TeacherCard.svelte src/lib/books/TeacherCard.test.js src/routes/books/+page.js src/routes/books/+page.svelte src/styles.css
git commit -m "feat: add teacher-first book catalogue"
```

## Task 4: Scope the cart bar to Book Delivery and implement selectable book lists

**Files:**

- Create: `src/lib/books/BookDeliveryBar.svelte`
- Create: `src/lib/books/BookRow.svelte`
- Create: `src/lib/books/BookRow.test.js`
- Create: `src/routes/books/+layout.svelte`
- Create: `src/routes/books/[teacherSlug]/+page.js`
- Create: `src/routes/books/[teacherSlug]/+page.svelte`

**Interfaces:**

- Consumes: `createBookCartStore`, `getTeacherBySlug`, `getTeacherBooks`, `BookCover`.
- Produces: a Book Delivery-only cart count and a teacher-detail draft selection that is committed with `addBooks([{ bookId, quantity }])`.

- [ ] **Step 1: Write a failing book-row test for cover, selection, and retailer links**

Create `src/lib/books/BookRow.test.js`:

```js
import { render, screen } from '@testing-library/svelte';
import { expect, it } from 'vitest';
import BookRow from './BookRow.svelte';

it('renders a cover, a selected checkbox, and a safe retailer link', () => {
	render(BookRow, {
		props: {
			book: {
				id: 'antigone',
				title: 'Antigone',
				format: 'Paperback',
				priceCents: 1695,
				coverUrl: null,
				coverTheme: 'sky',
				storefrontUrl: 'https://books.example/antigone'
			},
			selected: true,
			quantity: 1
		}
	});
	expect(screen.getByLabelText(/select antigone/i)).toBeChecked();
	expect(screen.getByLabelText(/cover placeholder for antigone/i)).toBeInTheDocument();
	expect(screen.getByRole('link', { name: /view at bookstore/i })).toHaveAttribute(
		'target',
		'_blank'
	);
});
```

- [ ] **Step 2: Run the row test and verify it fails**

Run: `npm test -- src/lib/books/BookRow.test.js`

Expected: FAIL because `BookRow.svelte` does not exist.

- [ ] **Step 3: Implement the book-only layout and teacher detail interaction**

`src/routes/books/+layout.svelte` creates one `createBookCartStore()` instance, calls `hydrate()` only in `onMount`, passes it through Svelte context, and renders `BookDeliveryBar` before `<slot />`. `BookDeliveryBar` contains a `Cart` link to `/books/cart` with an accessible item count. It must not modify `SiteHeader` or add a cart to club routes.

The teacher-detail page must:

1. Resolve a teacher by slug or throw SvelteKit `error(404, 'Teacher not found')`.
2. Group books by course heading.
3. Initialize a local `Map<bookId, quantity>` with every teacher book ID at quantity `1`, without changing the persisted cart just because the page opened.
4. Use `BookRow` checkbox events to remove or restore an entry in that map and show quantity controls only while selected.
5. Use a button named `Add selected books to cart` that calls `cart.addBooks([...selection.entries()].map(([bookId, quantity]) => ({ bookId, quantity })))` and then visibly confirms the number added.

Do not write pickup copy on this page.

- [ ] **Step 4: Verify select/unselect, cart scoping, and external-link behavior**

Run:

```bash
npm test -- src/lib/books/BookRow.test.js src/lib/books/cart-store.test.js
npm run check
npm run lint
```

Manual check: open `/books/mme-tremblay`, unselect one book, select `Add selected books to cart`, then confirm the `/books/cart` count excludes that book. Open `/about-us` and confirm no cart control is present.

- [ ] **Step 5: Commit the selectable detail experience**

```bash
git add src/lib/books/BookDeliveryBar.svelte src/lib/books/BookRow.svelte src/lib/books/BookRow.test.js src/routes/books/+layout.svelte src/routes/books/[teacherSlug]
git commit -m "feat: add selectable course book lists"
```

## Task 5: Build the bookstore-grouped cart and checkout handoff

**Files:**

- Create: `src/lib/books/BookstoreCartGroup.svelte`
- Create: `src/lib/books/CartTotals.svelte`
- Create: `src/lib/books/CartTotals.test.js`
- Create: `src/routes/books/cart/+page.svelte`

**Interfaces:**

- Consumes: cart store, `calculateCart`, `formatCad`, and catalogue fixture.
- Produces: a cart with an honest per-bookstore fee breakdown and a button to `/books/checkout`.

- [ ] **Step 1: Write a failing total-display test**

Create `src/lib/books/CartTotals.test.js`:

```js
import { render, screen } from '@testing-library/svelte';
import { expect, it } from 'vitest';
import CartTotals from './CartTotals.svelte';

it('labels the store fee once and exposes the final amount', () => {
	render(CartTotals, {
		props: {
			summary: {
				bookSubtotalCents: 4890,
				taxCents: 807,
				fees: [
					{ bookstoreId: 'renaud-bray', label: 'Renaud-Bray pickup service', amountCents: 500 }
				],
				totalCents: 6197
			}
		}
	});
	expect(screen.getByText('Renaud-Bray pickup service')).toBeInTheDocument();
	expect(screen.getByText('$61.97')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- src/lib/books/CartTotals.test.js`

Expected: FAIL because `CartTotals.svelte` does not exist.

- [ ] **Step 3: Implement cart groups and an empty state**

`BookstoreCartGroup.svelte` renders each bookstore heading, its line items, its one labeled service fee, and quantity or removal controls. `CartTotals.svelte` renders book subtotal, each fee line, taxes, and total with `formatCad`.

The cart route must render:

```svelte
{#if summary.lines.length === 0}
	<h1>Your cart is empty</h1>
	<a href="/books">Browse teachers</a>
{:else}
	<!-- bookstore groups, totals, and checkout link -->
{/if}
```

The checkout link is a nonfunctional handoff to `/books/checkout` until the commerce plan creates that route. Label it `Continue to checkout`, not `Pay`, because price verification and payment have not happened yet.

- [ ] **Step 4: Verify fee grouping and cart updates**

Run:

```bash
npm test -- src/lib/books/CartTotals.test.js src/lib/books/cart.test.js
npm run check
npm run lint
npm run build
```

Manual check: add two Renaud-Bray books and one Archambault book. Confirm exactly two fee rows appear, then remove the Archambault book and confirm its fee disappears.

- [ ] **Step 5: Commit the cart**

```bash
git add src/lib/books/BookstoreCartGroup.svelte src/lib/books/CartTotals.svelte src/lib/books/CartTotals.test.js src/routes/books/cart/+page.svelte
git commit -m "feat: add bookstore-grouped book cart"
```

## Task 6: Add Book Delivery visual regression coverage

**Files:**

- Create: `tests/e2e/book-delivery.spec.js`
- Modify: `playwright.config.js`

**Interfaces:**

- Consumes: `/books`, one fixture teacher route, and the book-only cart bar.
- Produces: stable browser coverage for core shopping behavior.

- [ ] **Step 1: Write the failing end-to-end test**

Create `tests/e2e/book-delivery.spec.js`:

```js
import { expect, test } from '@playwright/test';

test('students can deselect a preset book before adding the rest to the cart', async ({ page }) => {
	await page.goto('/books/mme-tremblay');
	await page.getByLabel(/select antigone/i).uncheck();
	await page.getByRole('button', { name: /add selected books to cart/i }).click();
	await page.getByRole('link', { name: /cart/i }).click();
	await expect(page.getByText('Antigone')).toHaveCount(0);
});

test('cart is absent from the club home but present inside Book Delivery', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('link', { name: /cart/i })).toHaveCount(0);
	await page.goto('/books');
	await expect(page.getByRole('link', { name: /cart/i })).toHaveCount(1);
});
```

- [ ] **Step 2: Run the test and correct actual interaction regressions**

Run: `npm run test:e2e -- tests/e2e/book-delivery.spec.js`

Expected: PASS after Tasks 1-5. Do not alter assertions to hide cart placement, selection, or accessibility failures.

- [ ] **Step 3: Capture mobile and desktop screenshots for review**

Run:

```bash
npm run test:e2e -- tests/e2e/book-delivery.spec.js --update-snapshots
```

Review `/books`, one teacher detail page, and `/books/cart` at 375px and 1440px. Confirm cover stacks, rows, and totals remain legible and the cart bar does not overlap page content.

- [ ] **Step 4: Run the complete catalogue quality gate**

Run:

```bash
npm run check
npm run lint
npm test
npm run test:e2e
npm run build
```

Expected: all commands pass.

- [ ] **Step 5: Commit browser coverage**

```bash
git add tests/e2e/book-delivery.spec.js playwright.config.js
git commit -m "test: cover book catalogue and cart flow"
```

## Plan self-review

- Spec coverage: teacher cards, stacked covers, left-side cover thumbnails, selected and unselected books, retailer links, Book Delivery-only cart, bookstore grouping, one fee per bookstore, responsive behavior, and no premature pickup information map to Tasks 1-6.
- Intentional boundary: local catalogue data and browser totals provide a complete visual shopping experience but are explicitly superseded by server-side catalogue, price verification, payment, order, email, and admin work in the companion commerce plan.
- Type consistency: `calculateCart` returns the exact `summary` consumed by `CartTotals`; `createBookCartStore` exposes the mutation names used by the teacher and cart pages; every book ID originates in `catalogue`.
