<script>
	import BookCover from './BookCover.svelte';

	/**
	 * @typedef {{
	 *   id: string,
	 *   title: string,
	 *   coverUrl: string | null,
	 *   coverTheme?: string
	 * }} StackBook
	 */

	/** @type {StackBook[]} */
	export let books = [];

	/** @type {number} */
	export let maxVisible = 3;

	$: visibleBooks = books.slice(0, Math.min(3, Math.max(0, maxVisible)));
</script>

<div class="book-cover-stack" data-count={visibleBooks.length} aria-hidden="true">
	{#each visibleBooks as book (book.id)}
		<div class="book-cover-layer">
			<BookCover
				title={book.title}
				src={book.coverUrl}
				theme={book.coverTheme ?? 'sky'}
				size="card"
				decorative
			/>
		</div>
	{/each}
</div>

<style>
	.book-cover-stack {
		display: grid;
		isolation: isolate;
		width: fit-content;
		max-width: 100%;
		padding-inline-end: 1.5rem;
		padding-block-end: 1rem;
		pointer-events: none;
		user-select: none;
	}

	.book-cover-layer {
		position: relative;
		grid-area: 1 / 1;
		width: max-content;
		max-width: 100%;
	}

	.book-cover-layer:nth-child(1) {
		z-index: 3;
		transform: translateY(1rem);
	}

	.book-cover-layer:nth-child(2) {
		z-index: 2;
		transform: translate(0.75rem, 0.5rem);
	}

	.book-cover-layer:nth-child(3) {
		z-index: 1;
		transform: translateX(1.5rem);
	}

	.book-cover-stack[data-count='1'] {
		padding: 0;
	}

	.book-cover-stack[data-count='1'] .book-cover-layer {
		transform: none;
	}

	.book-cover-stack[data-count='2'] {
		padding-inline-end: 0.875rem;
		padding-block-end: 0.625rem;
	}

	.book-cover-stack[data-count='2'] .book-cover-layer:nth-child(1) {
		transform: translateY(0.625rem);
	}

	.book-cover-stack[data-count='2'] .book-cover-layer:nth-child(2) {
		transform: translateX(0.875rem);
	}
</style>
