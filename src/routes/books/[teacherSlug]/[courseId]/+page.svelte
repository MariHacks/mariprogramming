<script>
	import { getContext, onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import BookRow from '$lib/books/BookRow.svelte';
	import { BOOK_CART_CONTEXT_KEY } from '$lib/books/cart-context';
	import { clubContent } from '$lib/content/club';

	/** @type {import('./$types').PageData} */
	export let data;

	/** @type {ReturnType<typeof import('$lib/books/cart-store').createBookCartStore>} */
	const cart = getContext(BOOK_CART_CONTEXT_KEY);
	const books = /** @type {Array<any>} */ (data.course.books);
	const courseBookIds = new Set(books.map((book) => book.id));

	let drafts = new Map(
		books.map((book) => [book.id, { selected: true, quantity: 1, title: book.title }])
	);
	let statusMessage = '';
	let interactive = false;

	onMount(() => {
		interactive = true;
	});

	$: selectedDrafts = Array.from(drafts.values()).filter((draft) => draft.selected);
	$: selectedTitleCount = selectedDrafts.length;
	$: selectedBookCount = selectedDrafts.reduce((total, draft) => total + draft.quantity, 0);
	$: courseHasCartItems = $cart.items.some(
		(item) => item.courseId === data.course.id && courseBookIds.has(item.bookId)
	);
	$: savedCourseItems = $cart.items.filter(
		(item) => item.courseId === data.course.id && courseBookIds.has(item.bookId)
	);
	$: selectionMatchesCart =
		courseHasCartItems &&
		savedCourseItems.length === selectedDrafts.length &&
		savedCourseItems.every((item) => {
			const draft = drafts.get(item.bookId);
			return draft?.selected === true && draft.quantity === item.quantity;
		});
	$: actionDisabled = !interactive || (selectedTitleCount === 0 && !courseHasCartItems);
	$: actionLabel =
		selectedTitleCount === 0 && !courseHasCartItems
			? 'Select a book to continue'
			: courseHasCartItems
				? 'Modify cart'
				: 'Add to cart';

	/** @param {CustomEvent<{ bookId: string, selected: boolean }>} event */
	function handleSelectionChange(event) {
		const draft = drafts.get(event.detail.bookId);
		if (!draft) return;

		drafts = new Map(drafts);
		drafts.set(event.detail.bookId, { ...draft, selected: event.detail.selected });
		statusMessage = `${draft.title} ${event.detail.selected ? 'selected' : 'removed from selection'}.`;
	}

	/** @param {CustomEvent<{ bookId: string, quantity: number }>} event */
	function handleQuantityChange(event) {
		const draft = drafts.get(event.detail.bookId);
		if (!draft) return;

		drafts = new Map(drafts);
		drafts.set(event.detail.bookId, { ...draft, quantity: event.detail.quantity });
		statusMessage = `Quantity for ${draft.title} changed to ${event.detail.quantity}.`;
	}

	async function applySelectionToCart() {
		if (actionDisabled) return;

		for (const book of books) {
			const draft = drafts.get(book.id);
			// Migrate a pre-course cart entry only when this course is explicitly applied.
			if (!(await cart.setSelected(book.id, false))) {
				statusMessage = "We couldn't update your cart. Try again.";
				return;
			}
			if (draft?.selected) {
				if (!(await cart.setQuantity(book.id, draft.quantity, data.course.id))) {
					statusMessage = "We couldn't update your cart. Try again.";
					return;
				}
			} else {
				if (!(await cart.setSelected(book.id, false, data.course.id))) {
					statusMessage = "We couldn't update your cart. Try again.";
					return;
				}
			}
		}

		statusMessage =
			selectedTitleCount === 0
				? `Removed ${data.course.code} from the cart.`
				: `Cart updated with ${selectedTitleCount} ${selectedTitleCount === 1 ? 'title' : 'titles'} and ${selectedBookCount} ${selectedBookCount === 1 ? 'book' : 'books'}.`;
	}

	const metaDescription = `Choose books for ${data.course.code} with ${data.teacher.name} through the Marianopolis Programming Club Book Delivery service.`;
</script>

<svelte:head>
	<title>{data.course.code} books | {clubContent.name}</title>
	<meta name="description" content={metaDescription} />
</svelte:head>

<div class="course-list-page surface-paper">
	<section class="course-hero">
		<div class="page-container hero-inner">
			<div class="hero-copy">
				<h1>
					<span class="course-code">{data.course.code}</span>
					<span>{data.course.title}</span>
				</h1>
				<p class="teacher-name">{data.teacher.name}</p>
			</div>
		</div>
	</section>

	<section
		class="course-checklist"
		aria-labelledby="course-books-heading"
		aria-busy={interactive ? 'false' : 'true'}
	>
		<div class="page-container checklist-inner">
			<header class="checklist-header">
				<h2 id="course-books-heading">Books for this course</h2>
				<p class="selection-count" aria-live="polite">
					{books.length === 0
						? 'No books listed'
						: selectedTitleCount === 0
							? 'No titles selected'
							: `${selectedTitleCount} ${selectedTitleCount === 1 ? 'title' : 'titles'} selected`}
				</p>
			</header>

			{#if books.length > 0}
				<ul class="book-list">
					{#each books as book (book.id)}
						<li>
							<BookRow
								{book}
								bookstoreName={book.bookstoreName}
								selected={drafts.get(book.id)?.selected ?? false}
								quantity={drafts.get(book.id)?.quantity ?? 1}
								{interactive}
								on:selectionchange={handleSelectionChange}
								on:quantitychange={handleQuantityChange}
							/>
						</li>
					{/each}
				</ul>

				<footer class="selection-footer">
					<div class="action-copy">
						{#if selectedTitleCount === 0}
							<p class="empty-state">No books selected</p>
						{/if}
						<p class="status-message" aria-live="polite" aria-atomic="true">{statusMessage}</p>
					</div>

					{#if selectionMatchesCart}
						<a class="cart-action" href={resolve('/books/cart', {})}>Go to cart</a>
					{:else}
						<button
							class="cart-action"
							type="button"
							disabled={actionDisabled}
							on:click={applySelectionToCart}
						>
							{actionLabel}
						</button>
					{/if}
				</footer>
			{:else}
				<p class="empty-books">No books are listed for this course.</p>
			{/if}
		</div>
	</section>
</div>

<style>
	.course-list-page {
		min-width: 0;
		min-height: 100%;
		background: var(--paper);
	}

	.course-hero {
		border-block-end: 1px solid rgb(var(--midnight-rgb) / 18%);
	}

	.hero-inner {
		display: grid;
		justify-items: start;
		padding-block: clamp(3.25rem, 7vw, 5.75rem) clamp(2.25rem, 4vw, 3.5rem);
	}

	.hero-copy {
		display: grid;
		justify-items: start;
		max-width: 48rem;
		gap: var(--space-sm);
	}

	.hero-copy h1 {
		display: grid;
		justify-items: start;
		max-width: 18ch;
		gap: var(--space-xs);
	}

	.course-code {
		color: var(--club-blue);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: 600;
		letter-spacing: 0.05em;
		line-height: 1.25;
	}

	.teacher-name {
		color: var(--graphite);
		font-size: var(--text-lg);
		font-weight: 600;
		line-height: 1.4;
	}

	.course-checklist {
		background: var(--paper);
		color: var(--graphite);
	}

	.checklist-inner {
		padding-block: clamp(2rem, 5vw, 4.5rem);
	}

	.checklist-header,
	.book-list,
	.selection-footer {
		width: min(100%, 68rem);
		margin-inline: auto;
	}

	.checklist-header {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: end;
		padding-block-end: var(--space-md);
		border-block-end: 1px solid rgb(var(--midnight-rgb) / 18%);
		gap: var(--space-lg);
	}

	.checklist-header h2 {
		max-width: 20ch;
		margin: 0;
		color: var(--midnight);
		font-size: clamp(1.5rem, 3vw, 2rem);
		letter-spacing: -0.035em;
		line-height: 1.15;
	}

	.selection-count {
		margin: 0;
		color: var(--graphite);
		font-size: var(--text-sm);
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		line-height: 1.4;
	}

	.book-list {
		display: grid;
		margin-top: var(--space-md);
		padding: 0;
		list-style: none;
	}

	.book-list li {
		min-width: 0;
		max-inline-size: none;
	}

	.empty-books {
		width: min(100%, 68rem);
		margin: 0 auto;
		padding-block: var(--space-xl);
		border-block-end: 1px solid rgb(var(--midnight-rgb) / 18%);
		color: var(--graphite);
		font-size: var(--text-lg);
		line-height: 1.45;
	}

	.selection-footer {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(15rem, auto);
		align-items: end;
		margin-top: clamp(2rem, 5vw, 3.5rem);
		padding-block-start: var(--space-lg);
		border-block-start: 1px solid rgb(var(--midnight-rgb) / 18%);
		gap: var(--space-lg);
	}

	.action-copy,
	.empty-state {
		display: grid;
		min-width: 0;
		margin: 0;
		gap: var(--space-2xs);
	}

	.empty-state {
		color: var(--midnight);
		font-family: var(--font-display);
		font-size: var(--text-lg);
		line-height: 1.35;
	}

	.status-message {
		min-height: 1.45em;
		margin: 0;
		color: rgb(var(--graphite-rgb) / 70%);
		font-size: var(--text-sm);
		line-height: 1.45;
	}

	.cart-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 3.25rem;
		padding: 0.85rem 1.2rem;
		border: 1px solid var(--midnight);
		border-radius: var(--radius-sm);
		background: var(--midnight);
		color: var(--paper);
		font-weight: 700;
		line-height: 1.25;
		text-decoration: none;
		cursor: pointer;
		transition:
			background-color var(--motion-fast) var(--ease-out),
			border-color var(--motion-fast) var(--ease-out),
			color var(--motion-fast) var(--ease-out);
	}

	.cart-action:disabled {
		border-color: rgb(var(--midnight-rgb) / 18%);
		background: rgb(var(--midnight-rgb) / 6%);
		color: rgb(var(--graphite-rgb) / 52%);
		cursor: not-allowed;
	}

	.cart-action:focus-visible {
		outline: 3px solid var(--coral);
		outline-offset: 3px;
	}

	@media (hover: hover) and (pointer: fine) {
		.cart-action:not(:disabled):hover {
			border-color: var(--club-blue);
			background: var(--club-blue);
		}
	}

	@media (max-width: 40rem) {
		.checklist-header {
			grid-template-columns: 1fr;
			align-items: start;
			gap: var(--space-xs);
		}

		.selection-footer {
			grid-template-columns: 1fr;
		}

		.cart-action {
			width: 100%;
		}
	}

	@media (max-width: 22rem) {
		.hero-inner,
		.checklist-inner {
			padding-inline: var(--space-sm);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.cart-action {
			transition: none;
		}
	}

	@media (forced-colors: active) {
		.course-hero,
		.checklist-header,
		.empty-books,
		.selection-footer,
		.cart-action {
			border-color: CanvasText;
		}

		.cart-action {
			background: Canvas;
			color: CanvasText;
		}
	}
</style>
