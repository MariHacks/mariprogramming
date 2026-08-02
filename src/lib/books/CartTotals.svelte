<script>
	import { formatCad } from '../format';

	/** @typedef {{ bookstoreId: string, label: string, amountCents: number }} Fee */
	/**
	 * @typedef {{
	 *   bookSubtotalCents: number,
	 *   fees: Fee[] | null | undefined,
	 *   taxCents: number,
	 *   totalCents: number
	 * }} Summary
	 */

	/** @type {Summary} */
	export let summary;

	$: fees = Array.isArray(summary.fees) ? summary.fees : [];
</script>

<aside class="cart-totals" aria-labelledby="order-summary-title">
	<h2 id="order-summary-title">Order summary</h2>

	<dl class="ledger">
		<div class="ledger-row">
			<dt>Book subtotal</dt>
			<dd>{formatCad(summary.bookSubtotalCents)}</dd>
		</div>

		{#each fees as fee (fee.bookstoreId)}
			<div class="ledger-row fee-row">
				<dt>{fee.label}</dt>
				<dd>{formatCad(fee.amountCents)}</dd>
			</div>
		{/each}

		<div class="ledger-row">
			<dt>Taxes</dt>
			<dd>{formatCad(summary.taxCents)}</dd>
		</div>

		<div class="ledger-row total-row">
			<dt>Order total</dt>
			<dd>{formatCad(summary.totalCents)}</dd>
		</div>
	</dl>
</aside>

<style>
	.cart-totals {
		display: grid;
		width: 100%;
		min-width: 0;
		padding: clamp(1.5rem, 4vw, 2.25rem);
		border: 1px solid rgb(153 194 255 / 44%);
		border-block-start: 0.375rem solid var(--sky);
		border-radius: var(--radius-md);
		background: var(--midnight);
		color: var(--paper);
		gap: var(--space-lg);
	}

	h2 {
		color: var(--paper);
		font-size: var(--text-xl);
	}

	.ledger {
		display: grid;
		margin: 0;
		border-block-start: 1px solid rgb(153 194 255 / 34%);
	}

	.ledger-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) max-content;
		align-items: baseline;
		padding-block: var(--space-xs);
		gap: var(--space-sm);
	}

	.ledger-row + .ledger-row {
		border-block-start: 1px solid rgb(247 244 237 / 16%);
	}

	dt,
	dd {
		min-width: 0;
		margin: 0;
	}

	dt {
		font-size: var(--text-sm);
		line-height: 1.35;
		overflow-wrap: anywhere;
	}

	dd {
		color: var(--paper);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		line-height: 1.35;
		text-align: end;
		white-space: nowrap;
	}

	.fee-row dt {
		color: var(--sky);
	}

	.total-row {
		align-items: center;
		margin-block-start: var(--space-xs);
		padding-block: var(--space-md) var(--space-xs);
	}

	.ledger-row + .total-row {
		border-block-start-color: var(--sky);
	}

	.total-row dt {
		color: var(--paper);
		font-family: var(--font-display);
		font-size: var(--text-lg);
		font-weight: 600;
	}

	.total-row dd {
		font-family: var(--font-display);
		font-size: clamp(1.625rem, 1.25rem + 1.8vw, 2.5rem);
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.05em;
		line-height: 1;
	}

	@media (max-width: 22rem) {
		.cart-totals {
			padding: var(--space-md);
			gap: var(--space-md);
		}

		.ledger-row {
			gap: var(--space-xs);
		}

		.total-row dd {
			font-size: 1.625rem;
		}
	}

	@media (forced-colors: active) {
		.cart-totals,
		.ledger,
		.ledger-row + .ledger-row {
			border-color: CanvasText;
		}

		.cart-totals {
			background: Canvas;
			color: CanvasText;
		}

		h2,
		dt,
		dd,
		.fee-row dt,
		.total-row dt {
			color: CanvasText;
		}
	}
</style>
