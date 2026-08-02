<script>
	import { createEventDispatcher } from 'svelte';
	import { formatCad } from '../format';
	import BookCover from './BookCover.svelte';

	/**
	 * @typedef {{
	 *   id: string,
	 *   title: string,
	 *   author: string,
	 *   format: string,
	 *   coverUrl: string | null,
	 *   coverTheme: string
	 * }} Book
	 */

	/**
	 * @typedef {{
	 *   book: Book,
	 *   quantity: number,
	 *   unitPriceCents: number,
	 *   amountCents: number
	 * }} CartLine
	 */

	/** @type {{ id: string, name: string }} */
	export let bookstore;

	/** @type {CartLine[]} */
	export let lines = [];

	/** @type {{ label: string, amountCents: number }} */
	export let fee;

	const dispatch = createEventDispatcher();

	$: bookCountLabel = `${lines.length} ${lines.length === 1 ? 'book' : 'books'}`;

	/** @param {number} quantity */
	function resolvedQuantity(quantity) {
		return Number.isSafeInteger(quantity) && quantity >= 1 ? quantity : 1;
	}

	/** @param {string} bookId @param {number} quantity */
	function requestQuantityChange(bookId, quantity) {
		if (quantity < 1) return;

		dispatch('quantitychange', { bookId, quantity });
	}

	/** @param {string} bookId */
	function requestRemove(bookId) {
		dispatch('remove', { bookId });
	}
</script>

<section class="bookstore-cart-group" aria-labelledby={`bookstore-heading-${bookstore.id}`}>
	<header class="group-header">
		<div class="bookstore-identity">
			<p class="eyebrow">Source bookstore</p>
			<h2 id={`bookstore-heading-${bookstore.id}`}>{bookstore.name}</h2>
			<p class="book-count">{bookCountLabel}</p>
		</div>

		<dl class="fee-line">
			<div>
				<dt>{fee.label}</dt>
				<dd>{formatCad(fee.amountCents)}</dd>
			</div>
		</dl>
	</header>

	<ol class="cart-lines">
		{#each lines as line (line.book.id)}
			{@const quantity = resolvedQuantity(line.quantity)}
			<li class="cart-line">
				<div class="line-cover">
					<BookCover
						title={line.book.title}
						src={line.book.coverUrl}
						theme={line.book.coverTheme}
						size="compact"
					/>
				</div>

				<div class="line-details">
					<header>
						<h3>{line.book.title}</h3>
						<p class="byline">
							<span>{line.book.author}</span>
							<span>{line.book.format}</span>
						</p>
					</header>

					<dl class="line-prices">
						<div>
							<dt>Unit price</dt>
							<dd>{formatCad(line.unitPriceCents)}</dd>
						</div>
						<div>
							<dt>Line total</dt>
							<dd>{formatCad(line.amountCents)}</dd>
						</div>
					</dl>
				</div>

				<div class="line-actions">
					<div
						class="quantity-control"
						role="group"
						aria-label={`Change quantity for ${line.book.title}`}
					>
						<button
							type="button"
							aria-label={`Decrease quantity for ${line.book.title}`}
							disabled={quantity <= 1}
							on:click={() => requestQuantityChange(line.book.id, quantity - 1)}>−</button
						>
						<output aria-label={`Quantity for ${line.book.title}`}>{quantity}</output>
						<button
							type="button"
							aria-label={`Increase quantity for ${line.book.title}`}
							on:click={() => requestQuantityChange(line.book.id, quantity + 1)}>+</button
						>
					</div>

					<button
						class="remove-button"
						type="button"
						aria-label={`Remove ${line.book.title}`}
						on:click={() => requestRemove(line.book.id)}>Remove</button
					>
				</div>
			</li>
		{/each}
	</ol>
</section>

<style>
	.bookstore-cart-group {
		min-width: 0;
		border: 1px solid rgb(5 13 46 / 24%);
		border-radius: var(--radius-md);
		background: var(--paper);
		box-shadow: var(--shadow-sm);
		color: var(--graphite);
		overflow: hidden;
	}

	.group-header {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(11rem, auto);
		align-items: end;
		padding: var(--space-md);
		border-block-end: 1px solid rgb(5 13 46 / 22%);
		background: var(--sky);
		gap: var(--space-md);
	}

	.bookstore-identity {
		display: grid;
		min-width: 0;
		gap: 0.25rem;
	}

	.eyebrow,
	.book-count,
	h2,
	h3,
	p,
	dl,
	dt,
	dd {
		margin: 0;
	}

	.eyebrow,
	dt {
		color: var(--club-blue);
		font-family: var(--font-mono);
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		line-height: 1.35;
		text-transform: uppercase;
	}

	h2,
	h3 {
		color: var(--midnight);
		overflow-wrap: anywhere;
	}

	h2 {
		font-size: clamp(1.35rem, 3vw, 1.8rem);
		letter-spacing: -0.045em;
		line-height: 1.08;
	}

	.book-count {
		color: rgb(5 13 46 / 72%);
		font-size: var(--text-sm);
		font-weight: 600;
		line-height: 1.35;
	}

	.fee-line {
		min-width: 0;
		padding: var(--space-xs) 0 var(--space-xs) var(--space-md);
		border-inline-start: 1px solid rgb(5 13 46 / 28%);
	}

	.fee-line div {
		display: grid;
		justify-items: end;
		min-width: 0;
		gap: 0.2rem;
	}

	.fee-line dt {
		max-width: 22ch;
		text-align: end;
	}

	dd {
		color: var(--midnight);
		font-size: var(--text-sm);
		font-weight: 700;
		line-height: 1.35;
		overflow-wrap: anywhere;
	}

	.fee-line dd,
	.line-prices dd,
	.quantity-control output {
		font-variant-numeric: tabular-nums;
	}

	.cart-lines {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.cart-line {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) minmax(12.5rem, auto);
		align-items: center;
		min-width: 0;
		padding: var(--space-md);
		border-block-end: 1px solid rgb(5 13 46 / 16%);
		gap: var(--space-md);
	}

	.cart-line:last-child {
		border-block-end: 0;
	}

	.line-cover {
		display: grid;
		place-items: center;
		align-self: stretch;
		min-width: 4.5rem;
		padding: var(--space-xs);
		border: 1px solid rgb(5 13 46 / 18%);
		border-radius: var(--radius-xs);
		background: var(--sky);
	}

	.line-details,
	.line-details header {
		display: grid;
		min-width: 0;
	}

	.line-details {
		gap: var(--space-sm);
	}

	.line-details header {
		gap: 0.25rem;
	}

	h3 {
		font-size: clamp(1.1rem, 2vw, 1.3rem);
		letter-spacing: -0.035em;
		line-height: 1.15;
	}

	.byline {
		display: flex;
		flex-wrap: wrap;
		color: rgb(24 27 37 / 76%);
		font-size: var(--text-sm);
		line-height: 1.4;
		gap: 0.25rem var(--space-sm);
	}

	.line-prices {
		display: flex;
		min-width: 0;
		border-block-start: 1px solid rgb(5 13 46 / 16%);
		padding-block-start: var(--space-xs);
		gap: var(--space-lg);
	}

	.line-prices div {
		display: grid;
		gap: 0.15rem;
	}

	.line-actions {
		display: grid;
		grid-template-columns: minmax(8.25rem, 1fr) auto;
		align-items: center;
		min-width: 12.5rem;
		padding-inline-start: var(--space-md);
		border-inline-start: 1px solid rgb(5 13 46 / 18%);
		gap: var(--space-xs);
	}

	.quantity-control {
		display: grid;
		grid-template-columns: 2.75rem minmax(2.75rem, 1fr) 2.75rem;
		min-width: 0;
		border: 1px solid rgb(5 13 46 / 30%);
		border-radius: var(--radius-xs);
		overflow: hidden;
		background: var(--paper);
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
		border-inline-end: 1px solid rgb(5 13 46 / 20%);
	}

	.quantity-control button:disabled {
		color: rgb(24 27 37 / 35%);
		cursor: not-allowed;
	}

	.remove-button {
		min-width: 2.75rem;
		min-height: 2.75rem;
		padding: 0.45rem 0.65rem;
		border: 1px solid rgb(5 13 46 / 30%);
		border-radius: var(--radius-xs);
		background: transparent;
		color: var(--club-blue);
		font: inherit;
		font-size: var(--text-sm);
		font-weight: 700;
		line-height: 1.2;
		cursor: pointer;
		transition:
			background-color var(--motion-fast) var(--ease-out),
			color var(--motion-fast) var(--ease-out);
	}

	.quantity-control button:focus-visible,
	.remove-button:focus-visible {
		outline: 3px solid var(--color-focus);
		outline-offset: 3px;
	}

	@media (hover: hover) and (pointer: fine) {
		.quantity-control button:not(:disabled):hover,
		.remove-button:hover {
			background: var(--sky);
		}

		.remove-button:hover {
			color: var(--midnight);
		}
	}

	@media (max-width: 44rem) {
		.group-header {
			grid-template-columns: 1fr;
			align-items: start;
			gap: var(--space-sm);
		}

		.fee-line {
			padding: var(--space-sm) 0 0;
			border-block-start: 1px solid rgb(5 13 46 / 24%);
			border-inline-start: 0;
		}

		.fee-line div {
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: baseline;
			justify-items: start;
			gap: var(--space-sm);
		}

		.fee-line dt {
			max-width: none;
			text-align: start;
		}

		.cart-line {
			grid-template-columns: auto minmax(0, 1fr);
			align-items: start;
			padding: var(--space-sm);
			gap: var(--space-sm);
		}

		.line-cover {
			align-self: start;
			min-width: 0;
			padding: 0.35rem;
		}

		.line-prices {
			flex-wrap: wrap;
			gap: var(--space-xs) var(--space-md);
		}

		.line-actions {
			grid-column: 1 / -1;
			grid-template-columns: minmax(0, 1fr) auto;
			min-width: 0;
			padding: var(--space-sm) 0 0;
			border-block-start: 1px solid rgb(5 13 46 / 18%);
			border-inline-start: 0;
		}
	}

	@media (max-width: 22rem) {
		.group-header {
			padding: var(--space-sm);
		}

		.line-prices {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.line-actions {
			grid-template-columns: 1fr;
		}

		.remove-button {
			width: 100%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.quantity-control button,
		.remove-button {
			transition: none;
		}
	}

	@media (forced-colors: active) {
		.bookstore-cart-group,
		.group-header,
		.fee-line,
		.cart-line,
		.line-cover,
		.line-prices,
		.line-actions,
		.quantity-control,
		.quantity-control button:first-child,
		.quantity-control output,
		.remove-button {
			border-color: CanvasText;
		}

		.group-header,
		.line-cover,
		.quantity-control,
		.remove-button {
			background: Canvas;
		}
	}
</style>
