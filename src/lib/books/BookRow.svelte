<script>
	import { createEventDispatcher } from 'svelte';
	import { formatCad } from '../format';
	import BookCover from './BookCover.svelte';

	/**
	 * @typedef {{
	 *   id: string,
	 *   courseId?: string,
	 *   title: string,
	 *   author: string | null,
	 *   format?: string | null,
	 *   priceCents: number,
	 *   bookstoreId?: string,
	 *   storefrontUrl: string | null,
	 *   coverUrl: string | null,
	 *   coverTheme?: string
	 * }} Book
	 */

	/** @type {Book} */
	export let book;

	/** @type {string} */
	export let bookstoreName;

	/** @type {boolean} */
	export let selected;

	/** @type {number} */
	export let quantity;

	/** @type {boolean} */
	export let interactive = true;

	const dispatch = createEventDispatcher();

	$: resolvedQuantity = Number.isSafeInteger(quantity) && quantity >= 1 ? quantity : 1;
	$: storefrontUrl =
		typeof book.storefrontUrl === 'string' && book.storefrontUrl.trim()
			? book.storefrontUrl.trim()
			: null;
	$: headingId = `book-${book.id}-title`;

	/** @param {Event} event */
	function requestSelectionChange(event) {
		const checkbox = /** @type {HTMLInputElement} */ (event.currentTarget);

		dispatch('selectionchange', {
			bookId: book.id,
			selected: checkbox.checked
		});
	}

	/** @param {number} requestedQuantity */
	function requestQuantityChange(requestedQuantity) {
		if (requestedQuantity < 1) return;

		dispatch('quantitychange', {
			bookId: book.id,
			quantity: requestedQuantity
		});
	}
</script>

<article class:book-row--unselected={!selected} class="book-row" aria-labelledby={headingId}>
	<div class="book-row__cover">
		<BookCover
			title={book.title}
			src={book.coverUrl}
			theme={book.coverTheme ?? 'sky'}
			size="compact"
		/>
	</div>

	<div class="book-row__details">
		<header>
			<h3 id={headingId}>{book.title}</h3>
			<p class="book-row__author">{book.author}</p>
		</header>

		<dl class="book-row__facts">
			{#if book.format}
				<div>
					<dt>Format</dt>
					<dd>{book.format}</dd>
				</div>
			{/if}
			<div>
				<dt>Bookstore</dt>
				<dd>{bookstoreName}</dd>
			</div>
			<div>
				<dt>Book price</dt>
				<dd class="book-row__price">{formatCad(book.priceCents)}</dd>
			</div>
		</dl>
	</div>

	<div class="book-row__actions">
		<label class="selection-control">
			<input
				type="checkbox"
				checked={selected}
				aria-label={`Select ${book.title}`}
				disabled={!interactive}
				on:change={requestSelectionChange}
			/>
			<span aria-hidden="true">{selected ? 'Selected' : 'Select book'}</span>
		</label>

		{#if selected}
			<div class="quantity-control" role="group" aria-label={`Change quantity for ${book.title}`}>
				<button
					type="button"
					aria-label={`Decrease quantity for ${book.title}`}
					disabled={!interactive || resolvedQuantity <= 1}
					on:click={() => requestQuantityChange(resolvedQuantity - 1)}>−</button
				>
				<output aria-label={`Quantity for ${book.title}`}>{resolvedQuantity}</output>
				<button
					type="button"
					aria-label={`Increase quantity for ${book.title}`}
					disabled={!interactive}
					on:click={() => requestQuantityChange(resolvedQuantity + 1)}>+</button
				>
			</div>
		{/if}

		{#if storefrontUrl}
			<a
				class="storefront-link"
				href={storefrontUrl}
				target="_blank"
				rel="external noreferrer"
				aria-label={`View at ${bookstoreName}, opens in a new tab`}
			>
				View at {bookstoreName}
				<svg viewBox="0 0 16 16" aria-hidden="true">
					<path d="M5 3h8v8M13 3 4 12" />
				</svg>
			</a>
		{/if}
	</div>
</article>

<style>
	.book-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) minmax(12rem, auto);
		align-items: center;
		min-width: 0;
		padding: var(--space-lg) var(--space-xs);
		border-block-end: 1px solid rgb(var(--midnight-rgb) / 16%);
		background: transparent;
		color: var(--graphite);
		gap: var(--space-md);
		transition: background-color var(--motion-fast) var(--ease-out);
	}

	.book-row--unselected {
		background: rgb(var(--sky-rgb) / 12%);
	}

	.book-row__cover {
		display: grid;
		place-items: center;
		align-self: start;
		min-width: 3.25rem;
	}

	.book-row__details,
	.book-row__details header {
		display: grid;
		min-width: 0;
	}

	.book-row__details {
		gap: 0.6rem;
	}

	.book-row__details header {
		gap: 0.25rem;
	}

	h3,
	p,
	dl,
	dt,
	dd {
		margin: 0;
	}

	h3 {
		color: var(--midnight);
		font-size: clamp(1.15rem, 2vw, 1.4rem);
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1.14;
		overflow-wrap: anywhere;
	}

	.book-row__author {
		color: rgb(var(--graphite-rgb) / 76%);
		font-size: var(--text-sm);
		line-height: 1.4;
		overflow-wrap: anywhere;
	}

	.book-row__facts {
		display: flex;
		min-width: 0;
		gap: clamp(var(--space-sm), 3vw, 1.75rem);
	}

	.book-row__facts div {
		display: grid;
		min-width: 0;
		gap: 0.15rem;
	}

	dt {
		color: var(--club-blue);
		font-family: var(--font-body);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.07em;
		line-height: 1.3;
		text-transform: uppercase;
	}

	dd {
		color: var(--midnight);
		font-size: 0.8125rem;
		font-weight: 600;
		line-height: 1.35;
		overflow-wrap: anywhere;
	}

	.book-row__price {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.book-row__actions {
		display: grid;
		justify-items: stretch;
		min-width: 12rem;
		padding-inline-start: var(--space-lg);
		border-inline-start: 1px solid rgb(var(--midnight-rgb) / 18%);
		gap: var(--space-xs);
	}

	.selection-control {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 2.75rem;
		padding: 0.45rem 0.65rem;
		border: 1px solid var(--midnight);
		border-radius: var(--radius-sm);
		background: var(--midnight);
		color: var(--paper);
		font-size: var(--text-sm);
		font-weight: 700;
		line-height: 1.2;
		cursor: pointer;
		gap: var(--space-xs);
	}

	.selection-control input {
		width: 1.1rem;
		height: 1.1rem;
		margin: 0;
		accent-color: var(--paper);
		cursor: pointer;
	}

	.selection-control:has(input:disabled) {
		cursor: not-allowed;
		opacity: 0.58;
	}

	.selection-control:has(input:disabled) input {
		cursor: not-allowed;
	}

	.book-row--unselected .selection-control {
		border-color: rgb(var(--club-blue-rgb) / 56%);
		background: var(--surface-raised);
		color: var(--club-blue);
	}

	.book-row--unselected .selection-control input {
		accent-color: var(--club-blue);
	}

	.quantity-control {
		display: grid;
		grid-template-columns: 2.75rem minmax(2.75rem, 1fr) 2.75rem;
		min-width: 0;
		border: 1px solid rgb(var(--midnight-rgb) / 22%);
		border-radius: var(--radius-sm);
		overflow: hidden;
		background: var(--surface-raised);
	}

	.quantity-control button,
	.quantity-control output {
		display: grid;
		place-items: center;
		min-height: 2.75rem;
		border: 0;
		background: transparent;
		color: var(--midnight);
		font: inherit;
		font-variant-numeric: tabular-nums;
		font-weight: 700;
	}

	.quantity-control button {
		min-width: 2.75rem;
		font-size: 1.1rem;
		cursor: pointer;
		transition:
			background-color var(--motion-fast) var(--ease-out),
			color var(--motion-fast) var(--ease-out);
	}

	.quantity-control button:first-child,
	.quantity-control output {
		border-inline-end: 1px solid rgb(var(--midnight-rgb) / 20%);
	}

	.quantity-control button:disabled {
		color: rgb(var(--graphite-rgb) / 35%);
		cursor: not-allowed;
	}

	.storefront-link {
		display: inline-flex;
		align-items: center;
		justify-content: flex-start;
		min-height: 2.75rem;
		color: var(--club-blue);
		font-size: 0.8125rem;
		font-weight: 700;
		line-height: 1.25;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.2em;
		gap: var(--space-xs);
	}

	.storefront-link svg {
		flex: 0 0 auto;
		width: 1rem;
		height: 1rem;
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 1.5;
	}

	.selection-control:has(input:focus-visible),
	.quantity-control button:focus-visible,
	.storefront-link:focus-visible {
		outline: 3px solid var(--color-focus);
		outline-offset: 3px;
	}

	@media (hover: hover) and (pointer: fine) {
		.book-row:hover {
			background: rgb(var(--sky-rgb) / 16%);
		}

		.selection-control:not(:has(input:disabled)):hover,
		.quantity-control button:not(:disabled):hover {
			background: var(--club-blue);
			color: var(--paper);
		}

		.book-row--unselected .selection-control:not(:has(input:disabled)):hover {
			border-color: var(--club-blue);
			background: var(--club-blue);
			color: var(--paper);
		}

		.storefront-link:hover {
			color: var(--midnight);
		}
	}

	@media (max-width: 44rem) {
		.book-row {
			grid-template-columns: auto minmax(0, 1fr);
			align-items: start;
			padding: var(--space-md) 0;
			gap: var(--space-sm);
		}

		.book-row__cover {
			align-self: start;
			min-width: 0;
		}

		.book-row__facts {
			flex-wrap: wrap;
			gap: var(--space-xs) var(--space-md);
		}

		.book-row__actions {
			grid-column: 1 / -1;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			min-width: 0;
			padding: var(--space-sm) 0 0;
			border-block-start: 1px solid rgb(var(--midnight-rgb) / 18%);
			border-inline-start: 0;
		}

		.storefront-link {
			grid-column: 1 / -1;
		}
	}

	@media (max-width: 22rem) {
		.book-row__facts {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.book-row__facts div:last-child {
			grid-column: 1 / -1;
		}

		.book-row__actions {
			grid-template-columns: 1fr;
		}

		.storefront-link {
			grid-column: auto;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.book-row,
		.quantity-control button {
			transition: none;
		}
	}

	@media (forced-colors: active) {
		.book-row,
		.book-row__cover,
		.book-row__actions,
		.selection-control,
		.quantity-control,
		.quantity-control button:first-child,
		.quantity-control output {
			border-color: CanvasText;
		}

		.book-row__cover,
		.book-row--unselected {
			background: Canvas;
		}
	}
</style>
