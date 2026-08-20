<script>
	import { resolve } from '$app/paths';
	import { getContext } from 'svelte';
	import { BOOK_CART_CONTEXT_KEY } from '$lib/books/cart-context';
	import BookstoreCartGroup from '$lib/books/BookstoreCartGroup.svelte';
	import CartTotals from '$lib/books/CartTotals.svelte';
	import { calculateCart, cartSelectionKey } from '$lib/books/cart';
	import { clubContent } from '$lib/content/club';

	/** @type {import('./$types').PageData} */
	export let data;
	const catalogue = data.catalogue;

	/**
	 * @typedef {{
	 *   id: string,
	 *   bookstoreId: string,
	 *   title: string,
	 *   author: string,
	 *   format?: string | null,
	 *   coverUrl: string | null,
	 *   coverTheme?: string
	 * }} DisplayBook
	 */

	/** @typedef {{ id: string, name: string }} DisplayBookstore */
	/** @typedef {{ bookstoreId: string, label: string, amountCents: number }} Fee */
	/** @typedef {{ courseId?: string, bookId: string, bookstoreId: string, quantity: number, unitPriceCents: number, amountCents: number }} SummaryLine */
	/** @typedef {{ courseId?: string, book: DisplayBook, quantity: number, unitPriceCents: number, amountCents: number }} DisplayLine */
	/** @typedef {{ bookstore: DisplayBookstore, fee: Fee, lines: DisplayLine[] }} BookstoreGroup */

	/** @type {ReturnType<typeof import('$lib/books/cart-store').createBookCartStore>} */
	const cart = getContext(BOOK_CART_CONTEXT_KEY);
	/** @type {Map<string, DisplayBook>} */
	const booksBySelection = new Map(
		catalogue.books.map((book) => [cartSelectionKey(book.courseId, book.id), book])
	);
	const bookIdCounts = new Map();
	for (const book of catalogue.books) {
		bookIdCounts.set(book.id, (bookIdCounts.get(book.id) ?? 0) + 1);
	}
	/** @type {Map<string, DisplayBookstore>} */
	const bookstoresById = new Map(
		catalogue.bookstores.map((bookstore) => [bookstore.id, bookstore])
	);

	/** @type {BookstoreGroup[]} */
	let groups = [];
	let statusMessage = '';
	let reconciliationKey = '';
	const availableBookIds = new Set(
		catalogue.books.flatMap((book) => [
			cartSelectionKey(book.courseId, book.id),
			...(bookIdCounts.get(book.id) === 1 ? [book.id] : [])
		])
	);

	$: reconciledCart = {
		items: $cart.items.filter(({ courseId, bookId }) =>
			availableBookIds.has(courseId === undefined ? bookId : cartSelectionKey(courseId, bookId))
		)
	};
	$: if (reconciledCart.items.length !== $cart.items.length) {
		const nextReconciliationKey = JSON.stringify($cart.items);
		if (reconciliationKey !== nextReconciliationKey) {
			reconciliationKey = nextReconciliationKey;
			void reconcileUnavailableBooks();
		}
	}
	$: summary = calculateCart(catalogue, reconciledCart);
	$: {
		/** @type {Map<string, Fee>} */
		const feesByBookstoreId = new Map(summary.fees.map((fee) => [fee.bookstoreId, fee]));
		/** @type {Map<string, BookstoreGroup>} */
		const groupsByBookstoreId = new Map();

		for (const line of /** @type {SummaryLine[]} */ (summary.lines)) {
			const book = booksBySelection.get(cartSelectionKey(line.courseId, line.bookId));
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
				...(line.courseId === undefined ? {} : { courseId: line.courseId }),
				book,
				quantity: line.quantity,
				unitPriceCents: line.unitPriceCents,
				amountCents: line.amountCents
			});
		}

		groups = Array.from(groupsByBookstoreId.values());
	}

	/** @param {string | undefined} courseId @param {string} bookId */
	function titleFor(courseId, bookId) {
		return booksBySelection.get(cartSelectionKey(courseId, bookId))?.title ?? 'Book';
	}

	async function reconcileUnavailableBooks() {
		try {
			const result = await cart.reconcile(availableBookIds);
			if (result === null) {
				statusMessage = "We couldn't update your cart. Try again.";
			} else if (result.removedCount > 0) {
				statusMessage = 'Some unavailable books were removed from your cart.';
			}
		} catch {
			statusMessage = "We couldn't update your cart. Try again.";
		}
	}

	/** @param {CustomEvent<{ courseId?: string, bookId: string, quantity: number }>} event */
	async function handleQuantityChange(event) {
		const hasLegacySelection = $cart.items.some(
			(item) => item.courseId === undefined && item.bookId === event.detail.bookId
		);
		const updated = await cart.setQuantity(
			event.detail.bookId,
			event.detail.quantity,
			hasLegacySelection ? undefined : event.detail.courseId
		);
		statusMessage = updated
			? `Quantity for ${titleFor(event.detail.courseId, event.detail.bookId)} updated to ${event.detail.quantity}.`
			: "We couldn't update your cart. Try again.";
	}

	/** @param {CustomEvent<{ courseId?: string, bookId: string }>} event */
	async function handleRemove(event) {
		const title = titleFor(event.detail.courseId, event.detail.bookId);
		const hasLegacySelection = $cart.items.some(
			(item) => item.courseId === undefined && item.bookId === event.detail.bookId
		);
		const updated = await cart.setSelected(
			event.detail.bookId,
			false,
			hasLegacySelection ? undefined : event.detail.courseId
		);
		statusMessage = updated
			? `${title} removed from your cart.`
			: "We couldn't update your cart. Try again.";
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
					<h1>Your cart is empty</h1>
					<p>Choose a course, then select the books you need.</p>
					<a class="browse-link" href={resolve('/books', {})}>Browse course lists</a>
					<p class="cart-status" aria-live="polite" aria-atomic="true">{statusMessage}</p>
				</div>
			</div>
		</section>
	{:else}
		<section class="cart-hero">
			<div class="page-container cart-hero-inner">
				<div class="cart-intro">
					<h1>Your cart</h1>
					<p>Your order includes one pickup service fee for each bookstore.</p>
				</div>
			</div>
		</section>

		<section class="cart-workspace" aria-label="Cart editing workspace">
			<div class="page-container cart-workspace-inner">
				<div class="cart-layout">
					<div class="cart-list">
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
						<a class="order-review-link" href={resolve('/books/checkout', {})}
							>Continue to order review</a
						>
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
		background: var(--paper);
	}

	.empty-cart {
		display: grid;
		min-height: calc(100vh - 3.75rem);
		align-items: center;
		border-block-start: 1px solid rgb(var(--midnight-rgb) / 18%);
	}

	.empty-cart-inner {
		padding-block: clamp(4rem, 12vw, 10rem);
	}

	.empty-copy {
		display: grid;
		width: min(100%, 44rem);
		padding-inline-start: clamp(1.25rem, 4vw, 3rem);
		border-inline-start: 0.375rem solid var(--club-blue);
		gap: var(--space-md);
	}

	.empty-copy h1,
	.cart-intro h1 {
		max-width: 15ch;
	}

	.empty-copy > p:not(.cart-status),
	.cart-intro > p {
		max-width: 43rem;
		color: rgb(var(--graphite-rgb) / 78%);
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
		border-block-end: 1px solid rgb(var(--midnight-rgb) / 18%);
		background: var(--paper);
	}

	.cart-hero-inner {
		padding-block: clamp(2.75rem, 6vw, 5rem) clamp(2rem, 4vw, 3.5rem);
	}

	.cart-intro {
		display: grid;
		width: min(100%, 46rem);
		gap: var(--space-sm);
	}

	.cart-intro h1 {
		font-size: clamp(2.25rem, 4vw, 3.5rem);
		letter-spacing: -0.04em;
	}

	.cart-workspace {
		background: var(--paper);
	}

	.cart-workspace-inner {
		padding-block: clamp(2rem, 5vw, 4.5rem) clamp(3rem, 7vw, 6rem);
	}

	.cart-layout {
		display: grid;
		align-items: start;
		min-width: 0;
		gap: clamp(1.5rem, 3.5vw, 3.5rem);
	}

	.cart-list,
	.summary-column,
	.bookstore-groups {
		display: grid;
		min-width: 0;
	}

	.cart-list {
		gap: var(--space-sm);
	}

	.bookstore-groups {
		gap: clamp(1.5rem, 3vw, 2.5rem);
	}

	.summary-column {
		align-content: start;
		padding: clamp(1.5rem, 3vw, 2.25rem);
		border-block-start: 0.25rem solid var(--sky);
		background: var(--midnight);
		gap: var(--space-md);
	}

	.summary-column :global(.cart-totals) {
		padding: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		box-shadow: none;
	}

	.order-review-link {
		justify-content: space-between;
		width: 100%;
		min-height: 3.5rem;
		border-color: var(--paper);
		background: var(--paper);
		color: var(--midnight);
	}

	.order-review-link::after {
		content: '→';
		font-size: 1.2em;
		line-height: 1;
	}

	.cart-status {
		min-height: 1.45em;
		margin: 0;
		color: var(--club-blue);
		font-size: var(--text-sm);
		font-weight: 600;
		line-height: 1.45;
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
			border-color: var(--sky);
			background: var(--sky);
			color: var(--midnight);
			transform: translateY(-0.125rem);
		}
	}

	@media (min-width: 68rem) {
		.cart-layout {
			grid-template-columns: minmax(0, 1.42fr) minmax(20rem, 0.58fr);
		}

		.summary-column {
			position: sticky;
			top: clamp(1rem, 3vw, 2.5rem);
		}
	}

	@media (max-width: 44rem) {
		.summary-column {
			padding: var(--space-md);
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
		.browse-link,
		.order-review-link,
		.summary-column {
			border-color: CanvasText;
		}

		.browse-link,
		.order-review-link,
		.summary-column {
			background: Canvas;
			color: CanvasText;
		}
	}
</style>
