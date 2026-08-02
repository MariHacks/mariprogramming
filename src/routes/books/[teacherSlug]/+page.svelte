<script>
	import { getContext, onMount } from 'svelte';
	import BookRow from '$lib/books/BookRow.svelte';
	import { BOOK_CART_CONTEXT_KEY } from '$lib/books/cart-context';
	import { clubContent } from '$lib/content/club';

	/** @type {import('./$types').PageData} */
	export let data;

	/** @type {ReturnType<typeof import('$lib/books/cart-store').createBookCartStore>} */
	const cart = getContext(BOOK_CART_CONTEXT_KEY);
	const books = data.courses.flatMap((course) => course.books);
	const teacherBookIds = new Set(books.map((book) => book.id));

	let drafts = new Map(
		books.map((book) => [book.id, { selected: true, quantity: 1, title: book.title }])
	);
	let hasAppliedSelection = false;
	let statusMessage = '';
	let interactive = false;

	onMount(() => {
		interactive = true;
	});

	$: selectedDrafts = Array.from(drafts.values()).filter((draft) => draft.selected);
	$: selectedTitleCount = selectedDrafts.length;
	$: selectedBookCount = selectedDrafts.reduce((total, draft) => total + draft.quantity, 0);
	$: teacherHasCartItems = $cart.items.some((item) => teacherBookIds.has(item.bookId));
	$: actionDisabled = !interactive || (selectedTitleCount === 0 && !teacherHasCartItems);
	$: actionVerb = hasAppliedSelection || teacherHasCartItems ? 'Update cart with' : 'Add';
	$: actionLabel =
		selectedTitleCount === 0
			? teacherHasCartItems
				? 'Remove this list from cart'
				: 'Select a book to continue'
			: `${actionVerb} ${selectedBookCount} ${selectedBookCount === 1 ? 'book' : 'books'}${actionVerb === 'Add' ? ' to cart' : ''}`;

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

	function applySelectionToCart() {
		if (actionDisabled) return;

		for (const book of books) {
			const draft = drafts.get(book.id);
			if (draft?.selected) {
				cart.setQuantity(book.id, draft.quantity);
			} else {
				cart.setSelected(book.id, false);
			}
		}

		hasAppliedSelection = true;
		statusMessage =
			selectedTitleCount === 0
				? `Removed ${data.teacher.name}'s list from the cart.`
				: `Cart updated with ${selectedTitleCount} ${selectedTitleCount === 1 ? 'title' : 'titles'} and ${selectedBookCount} ${selectedBookCount === 1 ? 'book' : 'books'}.`;
	}

	const metaDescription = `Choose books for ${data.teacher.name}'s courses through the Marianopolis Programming Club Book Delivery service.`;
</script>

<svelte:head>
	<title>Books for {data.teacher.name} | {clubContent.name}</title>
	<meta name="description" content={metaDescription} />
</svelte:head>

<div class="teacher-list-page surface-paper">
	<section class="teacher-hero">
		<div class="page-container hero-grid">
			<div class="hero-copy">
				<p class="eyebrow">Teacher book list</p>
				<h1>Books for {data.teacher.name}</h1>
				<p class="hero-summary">Choose the books you need, then add the selection to your cart.</p>
			</div>

			<aside class="course-register" aria-label="Courses on this list">
				<p class="register-label">Courses on this list</p>
				<ul>
					{#each data.courses as course (course.id)}
						<li>
							<span>{course.code}</span>
							<strong>{course.title}</strong>
						</li>
					{/each}
				</ul>
			</aside>
		</div>
	</section>

	<section
		class="course-checklist surface-navy"
		aria-label="Course book checklist"
		aria-busy={interactive ? 'false' : 'true'}
	>
		<div class="page-container checklist-inner">
			<header class="checklist-header">
				<div>
					<p class="utility-label">Course checklist</p>
					<p class="checklist-note">Review each course before adding your selection.</p>
				</div>
				<p class="selection-count" aria-live="polite">
					{selectedTitleCount === 0
						? 'No titles selected'
						: `${selectedTitleCount} ${selectedTitleCount === 1 ? 'title' : 'titles'} selected`}
				</p>
			</header>

			<div class="course-groups">
				{#each data.courses as course (course.id)}
					<section class="course-group" aria-labelledby={`course-${course.id}`}>
						<header class="course-heading">
							<h2 id={`course-${course.id}`}>
								<span class="course-code">{course.code}</span>
								<span>{course.title}</span>
							</h2>
							<p>{course.books.length} {course.books.length === 1 ? 'title' : 'titles'}</p>
						</header>

						<ul class="book-list">
							{#each course.books as book (book.id)}
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
					</section>
				{/each}
			</div>

			<footer class="selection-footer">
				<div class="action-copy">
					{#if selectedTitleCount === 0}
						<p class="empty-state">
							<strong>No books selected</strong>
							<span>
								{teacherHasCartItems
									? 'Update the cart to remove this teacher list.'
									: 'Select at least one title to add it to your cart.'}
							</span>
						</p>
					{:else}
						<p class="selection-detail">
							{selectedBookCount}
							{selectedBookCount === 1 ? 'book' : 'books'} across
							{selectedTitleCount}
							{selectedTitleCount === 1 ? 'title' : 'titles'}
						</p>
					{/if}
					<p class="status-message" aria-live="polite" aria-atomic="true">{statusMessage}</p>
				</div>

				<button
					class="cart-action"
					type="button"
					disabled={actionDisabled}
					on:click={applySelectionToCart}
				>
					{actionLabel}
				</button>
			</footer>
		</div>
	</section>
</div>

<style>
	.teacher-list-page {
		min-width: 0;
		min-height: 100%;
	}

	.teacher-hero {
		border-block-end: 1px solid rgb(5 13 46 / 18%);
	}

	.hero-grid {
		display: grid;
		padding-block: clamp(3.5rem, 8vw, 7rem);
		gap: var(--space-xl);
	}

	.hero-copy {
		display: grid;
		align-content: start;
		max-width: 47rem;
		gap: var(--space-md);
	}

	.hero-copy h1 {
		max-width: 15ch;
	}

	.hero-summary {
		max-width: 39rem;
		color: rgb(24 27 37 / 76%);
		font-size: var(--text-lg);
		line-height: 1.55;
		text-wrap: pretty;
	}

	.course-register {
		align-self: end;
		min-width: 0;
		border-block-start: 0.25rem solid var(--club-blue);
		background: var(--sky);
		box-shadow: var(--shadow-sm);
	}

	.register-label {
		padding: var(--space-sm) var(--space-md);
		border-block-end: 1px solid rgb(5 13 46 / 22%);
		color: var(--club-blue);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 0.09em;
		line-height: 1.4;
		text-transform: uppercase;
	}

	.course-register ul,
	.book-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.course-register li {
		display: grid;
		grid-template-columns: minmax(5.5rem, auto) minmax(0, 1fr);
		align-items: baseline;
		padding: var(--space-sm) var(--space-md);
		color: var(--midnight);
		gap: var(--space-sm);
	}

	.course-register li + li {
		border-block-start: 1px solid rgb(5 13 46 / 18%);
	}

	.course-register li span {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: 600;
		letter-spacing: 0.05em;
	}

	.course-register li strong {
		min-width: 0;
		font-family: var(--font-display);
		line-height: 1.25;
	}

	.course-checklist {
		border-block-start: 0.375rem solid var(--sky);
	}

	.checklist-inner {
		padding-block: clamp(3rem, 7vw, 6rem);
	}

	.checklist-header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		padding-block-end: var(--space-lg);
		border-block-end: 1px solid rgb(153 194 255 / 36%);
		gap: var(--space-lg);
	}

	.checklist-header > div {
		display: grid;
		gap: var(--space-sm);
	}

	.checklist-note {
		color: rgb(247 244 237 / 72%);
		font-size: var(--text-lg);
		line-height: 1.5;
	}

	.selection-count {
		flex: 0 0 auto;
		padding: 0.7rem 0.85rem;
		border: 1px solid rgb(153 194 255 / 64%);
		color: var(--sky);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		letter-spacing: 0.07em;
		line-height: 1.3;
		text-transform: uppercase;
	}

	.course-groups {
		display: grid;
		margin-block-start: clamp(2.5rem, 6vw, 5rem);
		gap: clamp(3rem, 7vw, 5.5rem);
	}

	.course-group {
		min-width: 0;
	}

	.course-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		padding-block-end: var(--space-md);
		gap: var(--space-md);
	}

	.course-heading h2 {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		min-width: 0;
		font-size: var(--text-2xl);
		gap: var(--space-sm);
	}

	.course-code {
		padding: 0.45rem 0.6rem;
		background: var(--sky);
		color: var(--midnight);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 0.07em;
		line-height: 1.2;
	}

	.course-heading p {
		flex: 0 0 auto;
		color: rgb(247 244 237 / 66%);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.book-list {
		display: grid;
		gap: var(--space-sm);
	}

	.book-list li {
		min-width: 0;
		max-inline-size: var(--reading-width);
	}

	.selection-footer {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(15rem, auto);
		align-items: end;
		margin-block-start: clamp(3rem, 7vw, 5.5rem);
		padding-block-start: var(--space-lg);
		border-block-start: 1px solid rgb(153 194 255 / 36%);
		gap: var(--space-lg);
	}

	.action-copy,
	.empty-state {
		display: grid;
		min-width: 0;
		gap: var(--space-2xs);
	}

	.empty-state strong,
	.selection-detail {
		color: var(--paper);
		font-family: var(--font-display);
		font-size: var(--text-lg);
		line-height: 1.35;
	}

	.empty-state span,
	.status-message {
		color: rgb(247 244 237 / 70%);
		font-size: var(--text-sm);
		line-height: 1.45;
	}

	.status-message {
		min-height: 1.45em;
	}

	.cart-action {
		min-height: 3.25rem;
		padding: 0.85rem 1.2rem;
		border: 1px solid var(--sky);
		border-radius: var(--radius-xs);
		background: var(--sky);
		color: var(--midnight);
		font-weight: 700;
		line-height: 1.25;
		cursor: pointer;
		transition:
			background-color var(--motion-fast) var(--ease-out),
			border-color var(--motion-fast) var(--ease-out),
			color var(--motion-fast) var(--ease-out);
	}

	.cart-action:disabled {
		border-color: rgb(247 244 237 / 28%);
		background: transparent;
		color: rgb(247 244 237 / 50%);
		cursor: not-allowed;
	}

	.cart-action:focus-visible {
		outline: 3px solid var(--coral);
		outline-offset: 3px;
		box-shadow: 0 0 0 6px var(--midnight);
	}

	@media (hover: hover) and (pointer: fine) {
		.cart-action:not(:disabled):hover {
			border-color: var(--paper);
			background: var(--paper);
		}
	}

	@media (min-width: 52rem) {
		.hero-grid {
			grid-template-columns: minmax(0, 1.45fr) minmax(18rem, 0.65fr);
			align-items: end;
		}
	}

	@media (max-width: 40rem) {
		.checklist-header,
		.course-heading {
			align-items: start;
			flex-direction: column;
		}

		.selection-count {
			align-self: stretch;
			width: 100%;
		}

		.selection-footer {
			grid-template-columns: 1fr;
		}

		.cart-action {
			width: 100%;
		}
	}

	@media (max-width: 22rem) {
		.hero-grid,
		.checklist-inner {
			padding-inline: var(--space-sm);
		}

		.course-register li {
			grid-template-columns: 1fr;
			gap: var(--space-3xs);
		}

		.course-heading h2 {
			align-items: flex-start;
			flex-direction: column;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.cart-action {
			transition: none;
		}
	}

	@media (forced-colors: active) {
		.teacher-hero,
		.course-register,
		.register-label,
		.course-register li,
		.course-checklist,
		.checklist-header,
		.selection-count,
		.course-code,
		.selection-footer,
		.cart-action {
			border-color: CanvasText;
		}

		.course-register,
		.course-code,
		.cart-action {
			background: Canvas;
			color: CanvasText;
		}
	}
</style>
