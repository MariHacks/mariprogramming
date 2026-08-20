<script>
	import { resolve } from '$app/paths';
	import { getContext, onMount } from 'svelte';
	import PickupMap from '$lib/books/PickupMap.svelte';
	import { BOOK_CART_CONTEXT_KEY } from '$lib/books/cart-context';
	import { retireCheckoutRequestId } from '$lib/books/checkout-request';
	import { clubContent } from '$lib/content/club';
	import { formatCad } from '$lib/format';

	/** @type {import('./$types').PageData} */
	export let data;

	/** @type {ReturnType<typeof import('$lib/books/cart-store').createBookCartStore>} */
	const cart = getContext(BOOK_CART_CONTEXT_KEY);
	let clientReady = false;
	/** @type {Set<string>} */
	const completedCleanupReferences = new Set();
	/** @type {Set<string>} */
	const inFlightCleanupReferences = new Set();
	/** @type {Map<string, import('./$types').PageData>} */
	const cleanupAttemptData = new Map();

	const presentations = Object.freeze({
		processing: {
			heading: 'Payment is processing',
			message:
				'Stripe has not confirmed payment yet. Refresh this page in a moment. Your cart will stay as it is.'
		},
		paid: {
			heading: 'Payment confirmed',
			message: 'Stripe has confirmed payment for this order.'
		},
		partially_refunded: {
			heading: 'Part of this payment was refunded',
			message: 'Stripe reports a partial refund. Check your Stripe receipt for the updated amount.'
		},
		refunded: {
			heading: 'This payment was refunded',
			message:
				'Stripe reports a full refund. Contact the club if you had already received a pickup message.'
		},
		expired: {
			heading: 'Payment window expired',
			message:
				'Stripe did not confirm payment before checkout expired. These books stay in your cart.'
		},
		failed: {
			heading: 'Payment was not confirmed',
			message: 'Stripe did not confirm this payment. These books stay in your cart.'
		},
		cancelled: {
			heading: 'Checkout cancelled',
			message: 'Checkout ended before payment was confirmed. These books stay in your cart.'
		}
	});

	const fulfillmentLabels = Object.freeze({
		unstarted: 'Purchasing has not started',
		purchasing: 'Books are being purchased',
		received: 'Books have reached the club',
		ready_for_pickup: 'Ready for pickup',
		picked_up: 'Picked up'
	});

	onMount(() => {
		clientReady = true;
	});

	/** @param {any} confirmation */
	async function cleanAuthorizedBrowserState(confirmation) {
		let cartReady = true;
		if (confirmation.browserCleanup.cartSelections.length > 0) {
			cartReady = await cart.consumeConfirmedOrder(
				confirmation.orderReference,
				confirmation.browserCleanup.cartSelections
			);
		}
		if (!cartReady) return false;

		return retireCheckoutRequestId({
			storage: globalThis.sessionStorage,
			expectedRequestId: confirmation.browserCleanup.requestId
		});
	}

	/** @param {any} confirmation */
	async function attemptAuthorizedBrowserCleanup(confirmation) {
		const orderReference = confirmation.orderReference;
		try {
			if (await cleanAuthorizedBrowserState(confirmation)) {
				completedCleanupReferences.add(orderReference);
			}
		} catch {
			// Browser privacy settings can block storage. A later page update can retry safely.
		} finally {
			inFlightCleanupReferences.delete(orderReference);
		}
	}

	$: unavailable = data.confirmation.status === 'unavailable';
	$: confirmation = unavailable ? null : data.confirmation;
	$: presentation = confirmation
		? presentations[/** @type {keyof typeof presentations} */ (confirmation.state)]
		: null;
	$: fulfillmentLabel = confirmation
		? fulfillmentLabels[
				/** @type {keyof typeof fulfillmentLabels} */ (confirmation.fulfillmentStatus)
			]
		: '';
	$: showPickup = confirmation?.state === 'paid';
	$: if (
		clientReady &&
		confirmation?.browserCleanup &&
		!completedCleanupReferences.has(confirmation.orderReference) &&
		!inFlightCleanupReferences.has(confirmation.orderReference) &&
		cleanupAttemptData.get(confirmation.orderReference) !== data
	) {
		cleanupAttemptData.set(confirmation.orderReference, data);
		inFlightCleanupReferences.add(confirmation.orderReference);
		void attemptAuthorizedBrowserCleanup(confirmation);
	}
</script>

<svelte:head>
	<title
		>{unavailable ? 'Order unavailable' : (presentation?.heading ?? 'Order confirmation')} | {clubContent.name}</title
	>
	<meta name="robots" content="noindex, nofollow" />
	<meta name="referrer" content="no-referrer" />
</svelte:head>

<div class="confirmation-page surface-paper">
	{#if unavailable}
		<section class="unavailable-workspace">
			<div class="unavailable-copy">
				<h1>We couldn't open this order</h1>
				<p>Use the same browser that started checkout, or return to your cart.</p>
				<nav class="confirmation-actions" aria-label="Order actions">
					<a class="button-primary" href={resolve(data.confirmation.returnPath, {})}
						>Return to your cart</a
					>
					<a class="button-secondary" href={resolve('/books', {})}>Browse courses</a>
				</nav>
			</div>
		</section>
	{:else if confirmation && presentation}
		<section
			class:confirmed-layout={confirmation.state === 'paid'}
			class="confirmation-layout"
			aria-label="Order receipt"
		>
			<div class="confirmation-workspace">
				<header class="confirmation-intro">
					<p class="confirmation-state">Order status</p>
					<h1>{presentation.heading}</h1>
					<p>{presentation.message}</p>
				</header>

				<dl class="confirmation-record">
					<div>
						<dt>Order reference</dt>
						<dd><code>{confirmation.orderReference}</code></dd>
					</div>
					<div>
						<dt>Receipt email</dt>
						<dd>{confirmation.receiptEmail}</dd>
					</div>
					<div>
						<dt>Book status</dt>
						<dd>{fulfillmentLabel}</dd>
					</div>
				</dl>

				<section class="order-lines" aria-labelledby="order-lines-title">
					<header class="section-heading">
						<h2 id="order-lines-title">Books in this order</h2>
					</header>
					<ol>
						{#each confirmation.books as book (`${book.courseId}:${book.bookId}`)}
							<li>
								<div class="book-copy">
									<h3>{book.title}</h3>
									<p class="course-line">
										<strong>{book.courseCode}</strong>
										<span>{book.courseTitle}</span>
									</p>
									<p class="book-meta">
										<span>{book.bookstoreName}</span>
										{#if book.isbn}<span>ISBN {book.isbn}</span>{/if}
									</p>
								</div>
								<dl class="line-money">
									<div>
										<dt>Quantity</dt>
										<dd>Quantity {book.quantity}</dd>
									</div>
									<div>
										<dt>Each</dt>
										<dd>{formatCad(book.unitAmountCents)}</dd>
									</div>
									<div>
										<dt>Line total</dt>
										<dd>{formatCad(book.lineAmountCents)}</dd>
									</div>
								</dl>
							</li>
						{/each}
					</ol>
				</section>

				<p class="manual-note">
					The club purchases books manually. The book status above is the club's latest update.
				</p>
				<nav class="confirmation-actions" aria-label="Order actions">
					<a class="button-secondary" href={resolve('/books', {})}>Browse courses</a>
				</nav>
			</div>

			<aside class="summary-rail" aria-label="Payment and pickup">
				<section class="payment-summary" aria-labelledby="payment-summary-title">
					<h2 id="payment-summary-title">Payment summary</h2>
					<dl>
						<div>
							<dt>Book subtotal</dt>
							<dd>{formatCad(confirmation.bookSubtotalCents)}</dd>
						</div>
						{#each confirmation.fees as fee (fee.bookstoreId)}
							<div class="fee-row">
								<dt>{fee.label}</dt>
								<dd>{formatCad(fee.amountCents)}</dd>
							</div>
						{/each}
						<div>
							<dt>Taxes</dt>
							<dd>{formatCad(confirmation.taxCents)}</dd>
						</div>
						<div class="total-row">
							<dt>Order total</dt>
							<dd>{formatCad(confirmation.totalCents)}</dd>
						</div>
						{#if confirmation.refundedAmountCents > 0}
							<div class="refund-row">
								<dt>Refunded to date</dt>
								<dd>{formatCad(confirmation.refundedAmountCents)}</dd>
							</div>
							<div>
								<dt>Net paid</dt>
								<dd>{formatCad(confirmation.totalCents - confirmation.refundedAmountCents)}</dd>
							</div>
						{/if}
					</dl>
				</section>

				{#if showPickup}
					<PickupMap />
				{/if}
			</aside>
		</section>
	{/if}
</div>

<style>
	.confirmation-page {
		min-width: 0;
		min-height: 100%;
		border-block-start: 1px solid rgb(var(--midnight-rgb) / 18%);
		background: var(--paper);
	}

	.confirmation-layout {
		display: grid;
		width: 100%;
		min-width: 0;
	}

	.confirmation-workspace,
	.summary-rail,
	.confirmation-intro,
	.order-lines,
	.payment-summary,
	.unavailable-workspace,
	.unavailable-copy {
		display: grid;
		min-width: 0;
	}

	.confirmation-workspace {
		align-content: start;
		padding: clamp(2rem, 5vw, 4.5rem);
		background: var(--surface-raised);
		gap: clamp(1.5rem, 3vw, 2.5rem);
	}

	.confirmation-intro {
		max-width: 46rem;
		padding-inline-start: var(--space-md);
		border-inline-start: 0.25rem solid var(--club-blue);
		gap: var(--space-xs);
	}

	.confirmed-layout .confirmation-intro {
		animation: confirmation-arrive var(--motion-base) var(--ease-out) both;
	}

	@keyframes -global-confirmation-arrive {
		from {
			opacity: 0;
			transform: translateY(0.35rem);
		}

		to {
			opacity: 1;
			transform: none;
		}
	}

	.confirmation-state {
		color: var(--club-blue);
		font-size: var(--text-xs);
		font-weight: 700;
		letter-spacing: 0.08em;
		line-height: 1.3;
		text-transform: uppercase;
	}

	.confirmation-intro h1 {
		max-width: 18ch;
		font-size: var(--text-3xl);
	}

	.confirmation-intro > p:last-child {
		max-width: 42rem;
		color: rgb(var(--graphite-rgb) / 80%);
		font-size: var(--text-base);
		line-height: 1.55;
		text-wrap: pretty;
	}

	.confirmation-record {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		margin: 0;
		border-block: 1px solid rgb(var(--midnight-rgb) / 18%);
	}

	.confirmation-record > div {
		display: grid;
		align-content: start;
		min-width: 0;
		padding: var(--space-sm) var(--space-md);
		gap: var(--space-3xs);
	}

	.confirmation-record > div:first-child {
		padding-inline-start: 0;
	}

	.confirmation-record > div + div {
		border-inline-start: 1px solid rgb(var(--midnight-rgb) / 18%);
	}

	dt,
	dd {
		min-width: 0;
		margin: 0;
	}

	dt {
		color: var(--quiet-steel);
		font-size: var(--text-xs);
		font-weight: 700;
		line-height: 1.35;
	}

	dd {
		color: var(--midnight);
		font-size: var(--text-sm);
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		line-height: 1.45;
		overflow-wrap: anywhere;
	}

	dd code {
		padding: 0;
		background: transparent;
		color: inherit;
		font-family: var(--font-mono);
		font-size: inherit;
	}

	.order-lines {
		gap: var(--space-sm);
	}

	.section-heading h2,
	.payment-summary h2 {
		font-size: var(--text-xl);
	}

	.order-lines ol {
		display: grid;
		margin: 0;
		padding: 0;
		border-block-start: 1px solid rgb(var(--midnight-rgb) / 18%);
		list-style: none;
	}

	.order-lines li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(12rem, auto);
		align-items: start;
		min-width: 0;
		padding-block: var(--space-md);
		border-block-end: 1px solid rgb(var(--midnight-rgb) / 18%);
		gap: var(--space-lg);
	}

	.book-copy {
		display: grid;
		min-width: 0;
		gap: var(--space-2xs);
	}

	.book-copy h3 {
		font-size: var(--text-lg);
	}

	.course-line,
	.book-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		margin: 0;
		gap: var(--space-2xs) var(--space-sm);
	}

	.course-line {
		color: var(--graphite);
		font-size: var(--text-sm);
		line-height: 1.45;
	}

	.book-meta {
		color: var(--quiet-steel);
		font-size: var(--text-xs);
		line-height: 1.45;
	}

	.line-money {
		display: grid;
		grid-template-columns: repeat(3, max-content);
		margin: 0;
		gap: var(--space-md);
	}

	.line-money > div {
		display: grid;
		justify-items: end;
		gap: var(--space-3xs);
	}

	.manual-note {
		max-width: 44rem;
		margin: 0;
		padding-inline-start: var(--space-sm);
		border-inline-start: 0.2rem solid var(--club-blue);
		color: rgb(var(--graphite-rgb) / 80%);
		font-size: var(--text-sm);
		line-height: 1.55;
	}

	.confirmation-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-sm);
	}

	.confirmation-actions :global(a) {
		min-height: 3rem;
	}

	.summary-rail {
		align-content: start;
		padding: clamp(2rem, 4vw, 3.5rem);
		background: var(--midnight);
		color: var(--paper);
		gap: clamp(2rem, 4vw, 3rem);
	}

	.payment-summary {
		gap: var(--space-md);
	}

	.payment-summary h2 {
		color: var(--paper);
	}

	.payment-summary dl {
		display: grid;
		margin: 0;
		border-block-start: 1px solid rgb(var(--sky-rgb) / 34%);
	}

	.payment-summary dl > div {
		display: grid;
		grid-template-columns: minmax(0, 1fr) max-content;
		align-items: baseline;
		padding-block: 0.7rem;
		border-block-end: 1px solid rgb(var(--paper-rgb) / 16%);
		gap: var(--space-sm);
	}

	.payment-summary dt {
		color: rgb(var(--paper-rgb) / 76%);
		font-size: var(--text-sm);
		font-weight: 500;
	}

	.payment-summary dd {
		color: var(--paper);
		white-space: nowrap;
	}

	.payment-summary .fee-row dt {
		color: var(--sky);
	}

	.payment-summary .total-row {
		padding-block: var(--space-md);
		border-block-end-color: var(--sky);
	}

	.payment-summary .total-row dt {
		color: var(--paper);
		font-family: var(--font-display);
		font-size: var(--text-lg);
		font-weight: 600;
	}

	.payment-summary .total-row dd {
		font-family: var(--font-display);
		font-size: var(--text-2xl);
	}

	.payment-summary .refund-row dt,
	.payment-summary .refund-row dd {
		color: var(--sky);
	}

	.unavailable-workspace {
		min-height: min(36rem, 70vh);
		align-content: center;
		padding: clamp(3.5rem, 8vw, 7rem) var(--page-gutter);
	}

	.unavailable-copy {
		width: min(100%, 44rem);
		margin-inline: auto;
		padding-inline-start: clamp(1.25rem, 4vw, 3rem);
		border-inline-start: 0.3rem solid var(--club-blue);
		gap: var(--space-md);
	}

	.unavailable-copy h1 {
		font-size: var(--text-3xl);
	}

	.unavailable-copy > p {
		max-width: 38rem;
		color: rgb(var(--graphite-rgb) / 80%);
		line-height: 1.6;
	}

	@media (min-width: 64rem) {
		.confirmation-layout {
			grid-template-columns: minmax(0, 1.15fr) minmax(25rem, 0.85fr);
		}

		.summary-rail {
			border-inline-start: 1px solid rgb(var(--sky-rgb) / 32%);
		}
	}

	@media (max-width: 63.99rem) {
		.summary-rail {
			border-block-start: 1px solid rgb(var(--sky-rgb) / 32%);
		}

		.summary-rail :global(.map-viewport) {
			aspect-ratio: auto;
			min-height: clamp(10rem, 45vw, 13rem);
		}
	}

	@media (max-width: 46rem) {
		.confirmation-workspace,
		.summary-rail {
			padding: var(--space-lg);
		}

		.confirmation-record {
			grid-template-columns: 1fr;
		}

		.confirmation-record > div,
		.confirmation-record > div:first-child {
			padding-inline: 0;
		}

		.confirmation-record > div + div {
			border-block-start: 1px solid rgb(var(--midnight-rgb) / 18%);
			border-inline-start: 0;
		}

		.order-lines li {
			grid-template-columns: 1fr;
			gap: var(--space-md);
		}

		.line-money {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.line-money > div {
			justify-items: start;
		}
	}

	@media (max-width: 24rem) {
		.confirmation-workspace,
		.summary-rail {
			padding: var(--space-md);
		}

		.line-money {
			grid-template-columns: 1fr;
		}

		.confirmation-actions {
			display: grid;
		}

		.confirmation-actions :global(a) {
			width: 100%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.confirmed-layout .confirmation-intro {
			animation-duration: var(--motion-press) !important;
			animation-delay: 0ms !important;
			transform: none !important;
		}

		.confirmation-actions :global(a) {
			transition: none;
		}
	}

	@media (forced-colors: active) {
		.confirmation-page,
		.confirmation-intro,
		.confirmation-record,
		.confirmation-record > div + div,
		.order-lines ol,
		.order-lines li,
		.manual-note,
		.summary-rail,
		.payment-summary dl,
		.payment-summary dl > div,
		.unavailable-copy {
			border-color: CanvasText;
		}

		.confirmation-page,
		.confirmation-workspace,
		.summary-rail,
		.unavailable-workspace {
			background: Canvas;
			color: CanvasText;
		}

		.confirmation-state,
		.confirmation-intro > p:last-child,
		dt,
		dd,
		.book-meta,
		.manual-note,
		.payment-summary h2,
		.payment-summary dt,
		.payment-summary dd,
		.payment-summary .fee-row dt,
		.payment-summary .refund-row dt,
		.payment-summary .refund-row dd,
		.unavailable-copy > p {
			color: CanvasText;
		}
	}
</style>
