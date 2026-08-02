<script>
	import { getContext } from 'svelte';
	import { BOOK_CART_CONTEXT_KEY } from '$lib/books/cart-context';
	import BookstoreCartGroup from '$lib/books/BookstoreCartGroup.svelte';
	import CartTotals from '$lib/books/CartTotals.svelte';
	import { calculateCart } from '$lib/books/cart';
	import { catalogue } from '$lib/books/catalogue';
	import { clubContent } from '$lib/content/club';

	/**
	 * @typedef {{
	 *   id: string,
	 *   bookstoreId: string,
	 *   title: string,
	 *   author: string,
	 *   format: string,
	 *   coverUrl: string | null,
	 *   coverTheme: string
	 * }} DisplayBook
	 */

	/** @typedef {{ id: string, name: string }} DisplayBookstore */
	/** @typedef {{ bookstoreId: string, label: string, amountCents: number }} Fee */
	/** @typedef {{ bookId: string, bookstoreId: string, quantity: number, unitPriceCents: number, amountCents: number }} SummaryLine */
	/** @typedef {{ book: DisplayBook, quantity: number, unitPriceCents: number, amountCents: number }} DisplayLine */
	/** @typedef {{ bookstore: DisplayBookstore, fee: Fee, lines: DisplayLine[] }} BookstoreGroup */

	/** @type {ReturnType<typeof import('$lib/books/cart-store').createBookCartStore>} */
	const cart = getContext(BOOK_CART_CONTEXT_KEY);
	/** @type {Map<string, DisplayBook>} */
	const booksById = new Map(catalogue.books.map((book) => [book.id, book]));
	/** @type {Map<string, DisplayBookstore>} */
	const bookstoresById = new Map(
		catalogue.bookstores.map((bookstore) => [bookstore.id, bookstore])
	);

	/** @type {BookstoreGroup[]} */
	let groups = [];
	let statusMessage = '';

	$: summary = calculateCart(catalogue, $cart);
	$: {
		/** @type {Map<string, Fee>} */
		const feesByBookstoreId = new Map(summary.fees.map((fee) => [fee.bookstoreId, fee]));
		/** @type {Map<string, BookstoreGroup>} */
		const groupsByBookstoreId = new Map();

		for (const line of /** @type {SummaryLine[]} */ (summary.lines)) {
			const book = booksById.get(line.bookId);
			const bookstore = bookstoresById.get(line.bookstoreId);
			const fee = feesByBookstoreId.get(line.bookstoreId);

			if (!book || !bookstore || !fee) {
				throw new Error(`Unable to display the cart line for ${line.bookId}`);
			}

			let group = groupsByBookstoreId.get(line.bookstoreId);
			if (!group) {
				group = { bookstore, fee, lines: [] };
				groupsByBookstoreId.set(line.bookstoreId, group);
			}

			group.lines.push({
				book,
				quantity: line.quantity,
				unitPriceCents: line.unitPriceCents,
				amountCents: line.amountCents
			});
		}

		groups = Array.from(groupsByBookstoreId.values());
	}

	/** @param {string} bookId */
	function titleFor(bookId) {
		return booksById.get(bookId)?.title ?? 'Book';
	}

	/** @param {CustomEvent<{ bookId: string, quantity: number }>} event */
	function handleQuantityChange(event) {
		cart.setQuantity(event.detail.bookId, event.detail.quantity);
		statusMessage = `Quantity for ${titleFor(event.detail.bookId)} updated to ${event.detail.quantity}.`;
	}

	/** @param {CustomEvent<{ bookId: string }>} event */
	function handleRemove(event) {
		const title = titleFor(event.detail.bookId);
		cart.setSelected(event.detail.bookId, false);
		statusMessage = `${title} removed from your cart.`;
	}

	const metaDescription =
		'Review and update your Book Delivery course books, grouped by source bookstore.';
</script>

<svelte:head>
	<title>Your cart | {clubContent.name}</title>
	<meta name="description" content={metaDescription} />
</svelte:head>

<div class="cart-page surface-paper">
	{#if summary.lines.length === 0}
		<section class="empty-cart">
			<div class="page-container empty-cart-inner">
				<div class="empty-copy">
					<p class="eyebrow">Book Delivery</p>
					<h1>Your cart is empty</h1>
					<p>Choose a teacher to start your course book list.</p>
					<a class="browse-link" href="/books">Browse teachers</a>
					<p class="cart-status" aria-live="polite" aria-atomic="true">{statusMessage}</p>
				</div>
			</div>
		</section>
	{:else}
		<section class="cart-hero">
			<div class="page-container cart-hero-inner">
				<div class="cart-intro">
					<p class="eyebrow">Book Delivery cart</p>
					<h1>Your book delivery cart</h1>
					<p>Books are grouped by bookstore. The service fee is applied once per bookstore.</p>
				</div>
			</div>
		</section>

		<section class="cart-workspace" aria-label="Cart editing workspace">
			<div class="page-container cart-workspace-inner">
				<div class="cart-layout">
					<div class="cart-list">
						<p class="list-index">Books by bookstore</p>
						<div class="bookstore-groups">
							{#each groups as group (group.bookstore.id)}
								<BookstoreCartGroup
									bookstore={group.bookstore}
									lines={group.lines}
									fee={group.fee}
									on:quantitychange={handleQuantityChange}
									on:remove={handleRemove}
								/>
							{/each}
						</div>
						<p class="cart-status" aria-live="polite" aria-atomic="true">{statusMessage}</p>
					</div>

					<div class="summary-column">
						<CartTotals {summary} />
						<a class="order-review-link" href="/books/checkout">Continue to order review</a>
					</div>
				</div>
			</div>
		</section>
	{/if}
</div>

<style>
	.cart-page {
		min-width: 0;
		min-height: 100%;
	}

	.empty-cart {
		min-height: calc(100vh - 3.75rem);
		display: grid;
		align-items: center;
		border-block-start: 0.375rem solid var(--sky);
	}

	.empty-cart-inner {
		padding-block: clamp(4rem, 12vw, 10rem);
	}

	.empty-copy {
		display: grid;
		width: min(100%, 44rem);
		padding-inline-start: clamp(1.25rem, 4vw, 3rem);
		border-inline-start: 0.375rem solid var(--coral);
		gap: var(--space-md);
	}

	.empty-copy h1,
	.cart-intro h1 {
		max-width: 15ch;
	}

	.empty-copy > p:not(.eyebrow, .cart-status),
	.cart-intro > p:not(.eyebrow) {
		max-width: 43rem;
		color: rgb(24 27 37 / 78%);
		font-size: var(--text-lg);
		line-height: 1.55;
		text-wrap: pretty;
	}

	.browse-link,
	.order-review-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 3.25rem;
		padding: 0.85rem 1.1rem;
		border: 1px solid var(--club-blue);
		border-radius: var(--radius-xs);
		font-size: var(--text-sm);
		font-weight: 700;
		line-height: 1.25;
		text-align: center;
		text-decoration: none;
		transition:
			background-color var(--motion-fast) var(--ease-out),
			border-color var(--motion-fast) var(--ease-out),
			color var(--motion-fast) var(--ease-out),
			transform var(--motion-fast) var(--ease-out);
	}

	.browse-link {
		justify-self: start;
		background: var(--club-blue);
		color: var(--paper);
	}

	.cart-hero {
		border-block-end: 1px solid rgb(5 13 46 / 18%);
	}

	.cart-hero-inner {
		padding-block: clamp(3.5rem, 8vw, 7rem);
	}

	.cart-intro {
		display: grid;
		width: min(100%, 52rem);
		gap: var(--space-md);
	}

	.cart-workspace {
		border-block-start: 0.375rem solid var(--sky);
		background: linear-gradient(to bottom, rgb(153 194 255 / 16%), transparent 22rem);
	}

	.cart-workspace-inner {
		padding-block: clamp(2.5rem, 6vw, 5.5rem);
	}

	.cart-layout {
		display: grid;
		align-items: start;
		min-width: 0;
		gap: clamp(2rem, 5vw, 5rem);
	}

	.cart-list,
	.summary-column,
	.bookstore-groups {
		display: grid;
		min-width: 0;
	}

	.cart-list {
		gap: var(--space-md);
	}

	.list-index {
		width: fit-content;
		max-width: 100%;
		margin: 0;
		padding: 0.45rem 0.6rem;
		border: 1px solid rgb(5 13 46 / 34%);
		background: var(--paper);
		color: var(--club-blue);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 0.08em;
		line-height: 1.3;
		text-transform: uppercase;
	}

	.bookstore-groups {
		gap: var(--space-lg);
	}

	.summary-column {
		align-content: start;
		gap: var(--space-sm);
	}

	.order-review-link {
		border-color: var(--midnight);
		background: var(--sky);
		color: var(--midnight);
	}

	.cart-status {
		min-height: 1.45em;
		margin: 0;
		color: var(--club-blue);
		font-size: var(--text-sm);
		font-weight: 600;
		line-height: 1.45;
	}

	.cart-status:empty {
		display: none;
	}

	.browse-link:focus-visible,
	.order-review-link:focus-visible {
		outline: 3px solid var(--color-focus);
		outline-offset: 4px;
	}

	@media (hover: hover) and (pointer: fine) {
		.browse-link:hover {
			border-color: var(--midnight);
			background: var(--midnight);
			transform: translateY(-0.125rem);
		}

		.order-review-link:hover {
			border-color: var(--club-blue);
			background: var(--paper);
			color: var(--club-blue);
			transform: translateY(-0.125rem);
		}
	}

	@media (min-width: 68rem) {
		.cart-layout {
			grid-template-columns: minmax(0, 1.35fr) minmax(20rem, 0.65fr);
		}
	}

	@media (max-width: 22rem) {
		.empty-copy {
			padding-inline-start: var(--space-md);
		}

		.browse-link,
		.order-review-link {
			width: 100%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.browse-link,
		.order-review-link {
			transition: none;
		}

		.browse-link:hover,
		.order-review-link:hover {
			transform: none;
		}
	}

	@media (forced-colors: active) {
		.empty-cart,
		.empty-copy,
		.cart-hero,
		.cart-workspace,
		.list-index,
		.browse-link,
		.order-review-link {
			border-color: CanvasText;
		}

		.list-index,
		.browse-link,
		.order-review-link {
			background: Canvas;
			color: CanvasText;
		}
	}
</style>
