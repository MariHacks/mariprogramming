<script>
	import { getContext, onMount } from 'svelte';
	import PickupMap from '$lib/books/PickupMap.svelte';
	import { BOOK_CART_CONTEXT_KEY } from '$lib/books/cart-context';
	import { clubContent } from '$lib/content/club';

	/**
	 * @typedef {{
	 *   status: 'paid',
	 *   orderReference: string,
	 *   receiptEmail: string | null,
	 *   lineItems: { title: string, quantity: number }[]
	 * }} PaidConfirmation
	 */

	/**
	 * @typedef {{
	 *   status: 'recovery',
	 *   reason: 'missing' | 'invalid' | 'unpaid' | 'expired' | 'unavailable',
	 *   returnPath: string
	 * }} RecoveryConfirmation
	 */

	/** @type {{ confirmation: PaidConfirmation | RecoveryConfirmation }} */
	export let data;

	/** @type {ReturnType<typeof import('$lib/books/cart-store').createBookCartStore>} */
	const cart = getContext(BOOK_CART_CONTEXT_KEY);
	let clientReady = false;
	let cartCleared = false;

	onMount(() => {
		queueMicrotask(() => {
			clientReady = true;
		});
	});

	$: confirmation = data.confirmation;
	$: paidConfirmation = confirmation.status === 'paid' ? confirmation : null;
	$: recoveryConfirmation = confirmation.status === 'recovery' ? confirmation : null;
	$: heading = paidConfirmation ? 'Payment confirmed' : 'Payment not confirmed';
	$: statusMessage = paidConfirmation ? 'Payment confirmed' : 'Payment not confirmed';
	$: recoveryMessage = {
		missing:
			'Use the confirmation link from your payment page, or return to your cart to start again.',
		invalid:
			'This payment confirmation link is not valid. Return to your cart to begin a new secure payment.',
		unpaid:
			'Stripe has not confirmed a successful payment for this order. Your cart is still available.',
		expired:
			'This payment confirmation link has expired. Your cart is still available to start a new secure payment.',
		unavailable: 'We could not check this payment right now. Your cart has not been changed.'
	}[recoveryConfirmation?.reason ?? 'unavailable'];
	$: if (clientReady && paidConfirmation && !cartCleared) {
		cart.clear();
		cartCleared = true;
	}

	const metaDescription =
		'View a server-verified Book Delivery payment confirmation and Marianopolis pickup reference.';
</script>

<svelte:head>
	<title
		>{paidConfirmation ? 'Payment confirmed' : 'Payment confirmation'} | {clubContent.name}</title
	>
	<meta name="description" content={metaDescription} />
</svelte:head>

<div class="confirmation-page surface-paper">
	<section class="confirmation-stage" aria-label="Book Delivery payment confirmation">
		<div class="page-container confirmation-stage-inner">
			<div
				class:paid-layout={paidConfirmation}
				class:recovery-layout={!paidConfirmation}
				class="confirmation-layout"
			>
				<section
					class:paid-card={paidConfirmation}
					class:recovery-card={!paidConfirmation}
					class="confirmation-card"
				>
					<header class="confirmation-intro">
						<p class="eyebrow">{paidConfirmation ? 'Book Delivery' : 'Payment check'}</p>
						<p
							class:paid-status={paidConfirmation}
							class="confirmation-status"
							role="status"
							aria-live="polite"
							aria-atomic="true"
						>
							<span aria-hidden="true"></span>
							{statusMessage}
						</p>
						<h1>{heading}</h1>
						{#if paidConfirmation}
							<p>
								Your payment was confirmed by Stripe. Keep the receipt email for your payment
								record.
							</p>
						{:else}
							<p>{recoveryMessage}</p>
						{/if}
					</header>

					{#if paidConfirmation}
						<dl class="confirmation-record">
							<div>
								<dt>Order reference</dt>
								<dd><code>{paidConfirmation.orderReference}</code></dd>
							</div>
							<div>
								<dt>Receipt email</dt>
								<dd>
									{#if paidConfirmation.receiptEmail}
										{paidConfirmation.receiptEmail}
									{:else}
										Check the email used at payment for your Stripe receipt.
									{/if}
								</dd>
							</div>
						</dl>

						{#if paidConfirmation.lineItems.length > 0}
							<section class="order-details" aria-labelledby="order-details-title">
								<h2 id="order-details-title">Order details</h2>
								<ol>
									{#each paidConfirmation.lineItems as line (line.title)}
										<li>
											<span>{line.title}</span>
											<span class="line-quantity">Quantity {line.quantity}</span>
										</li>
									{/each}
								</ol>
							</section>
						{/if}

						<p class="manual-note">
							Our club reviews paid orders and purchases books manually. Pickup timing is confirmed
							separately.
						</p>
						<div class="confirmation-actions">
							<a class="button-primary" href="/books">Back to Book Delivery</a>
						</div>
					{:else if recoveryConfirmation}
						<div class="confirmation-actions">
							<a class="button-primary" href={recoveryConfirmation.returnPath}
								>Return to your cart</a
							>
							<a class="button-secondary" href="/books">Browse Book Delivery</a>
						</div>
					{/if}
				</section>

				{#if paidConfirmation}
					<aside class="pickup-rail" aria-label="Pickup location reference">
						<p class="rail-label">Pickup reference</p>
						<PickupMap />
					</aside>
				{/if}
			</div>
		</div>
	</section>
</div>

<style>
	.confirmation-page {
		min-width: 0;
		min-height: 100%;
	}

	.confirmation-stage {
		border-block-start: 0.375rem solid var(--sky);
		background: linear-gradient(135deg, rgb(153 194 255 / 25%), transparent 44rem), var(--paper);
	}

	.confirmation-stage-inner {
		padding-block: clamp(2rem, 6vw, 6rem);
	}

	.confirmation-layout {
		display: grid;
		min-width: 0;
		border: 1px solid rgb(5 13 46 / 24%);
		border-radius: var(--radius-md);
		background: var(--paper);
		box-shadow: var(--shadow-md);
		overflow: hidden;
	}

	.confirmation-card,
	.confirmation-intro,
	.confirmation-record,
	.order-details,
	.pickup-rail {
		display: grid;
		min-width: 0;
	}

	.confirmation-card {
		align-content: start;
		padding: clamp(1.5rem, 4vw, 3.5rem);
		gap: var(--space-lg);
	}

	.recovery-layout {
		width: min(100%, 48rem);
		margin-inline: auto;
	}

	.paid-card {
		border-block-start: 0.375rem solid var(--sky);
	}

	.recovery-card {
		border-block-start: 0.375rem solid var(--coral);
	}

	.confirmation-intro {
		gap: var(--space-sm);
	}

	.confirmation-intro h1 {
		max-width: 13ch;
	}

	.confirmation-intro > p:not(.eyebrow, .confirmation-status) {
		max-width: 44rem;
		color: rgb(24 27 37 / 80%);
		font-size: var(--text-lg);
		line-height: 1.55;
		text-wrap: pretty;
	}

	.confirmation-status {
		display: inline-flex;
		align-items: center;
		width: fit-content;
		max-width: 100%;
		padding: 0.45rem 0.6rem;
		border: 1px solid rgb(5 13 46 / 28%);
		border-radius: var(--radius-xs);
		background: rgb(223 91 72 / 12%);
		color: var(--midnight);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 0.07em;
		line-height: 1.35;
		text-transform: uppercase;
		gap: var(--space-2xs);
	}

	.confirmation-status span {
		width: 0.55rem;
		height: 0.55rem;
		flex: 0 0 auto;
		border: 1px solid currentColor;
		border-radius: var(--radius-pill);
		background: var(--coral);
	}

	.confirmation-status.paid-status {
		background: rgb(153 194 255 / 30%);
	}

	.paid-status span {
		background: var(--sky);
	}

	.confirmation-record {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		border-block: 1px solid rgb(5 13 46 / 18%);
		gap: var(--space-md);
	}

	.confirmation-record > div {
		display: grid;
		min-width: 0;
		padding-block: var(--space-sm);
		gap: var(--space-3xs);
	}

	.confirmation-record > div + div {
		border-inline-start: 1px solid rgb(5 13 46 / 18%);
		padding-inline-start: var(--space-md);
	}

	dt,
	.rail-label,
	.line-quantity {
		color: var(--club-blue);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 0.08em;
		line-height: 1.35;
		text-transform: uppercase;
	}

	dd {
		min-width: 0;
		color: var(--midnight);
		font-size: var(--text-sm);
		font-weight: 600;
		line-height: 1.5;
		overflow-wrap: anywhere;
	}

	dd code {
		display: inline;
		padding: 0;
		background: transparent;
		color: inherit;
		font-size: inherit;
		overflow-wrap: anywhere;
	}

	.order-details {
		gap: var(--space-sm);
	}

	.order-details h2 {
		font-size: var(--text-xl);
	}

	.order-details ol {
		display: grid;
		margin: 0;
		padding: 0;
		border-block-start: 1px solid rgb(5 13 46 / 18%);
		list-style: none;
	}

	.order-details li {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		min-width: 0;
		padding-block: var(--space-sm);
		border-block-end: 1px solid rgb(5 13 46 / 18%);
		gap: var(--space-md);
	}

	.order-details li > span:first-child {
		min-width: 0;
		color: var(--midnight);
		font-weight: 600;
		line-height: 1.4;
	}

	.line-quantity {
		flex: 0 0 auto;
		font-size: 0.6875rem;
		text-align: end;
	}

	.manual-note {
		max-width: 52rem;
		padding-inline-start: var(--space-md);
		border-inline-start: 0.25rem solid var(--coral);
		color: rgb(24 27 37 / 80%);
		font-size: var(--text-sm);
		line-height: 1.55;
	}

	.confirmation-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-sm);
	}

	.pickup-rail {
		align-content: start;
		padding: clamp(1.25rem, 3vw, 2.5rem);
		background: var(--midnight);
		gap: var(--space-md);
	}

	.rail-label {
		margin: 0;
		color: var(--sky);
	}

	.confirmation-actions :global(.button-primary),
	.confirmation-actions :global(.button-secondary) {
		min-height: 3.25rem;
	}

	@media (min-width: 64rem) {
		.confirmation-layout.paid-layout {
			grid-template-columns: minmax(0, 1.12fr) minmax(22rem, 0.88fr);
		}

		.pickup-rail {
			border-inline-start: 1px solid rgb(153 194 255 / 32%);
		}
	}

	@media (max-width: 63.99rem) {
		.pickup-rail :global(.map-viewport) {
			aspect-ratio: auto;
			min-height: clamp(10rem, 45vw, 13rem);
		}
	}

	@media (max-width: 22rem) {
		.confirmation-card,
		.pickup-rail {
			padding: var(--space-md);
		}

		.confirmation-record {
			grid-template-columns: 1fr;
			gap: 0;
		}

		.confirmation-record > div + div {
			border-block-start: 1px solid rgb(5 13 46 / 18%);
			border-inline-start: 0;
			padding-inline-start: 0;
		}

		.order-details li {
			align-items: flex-start;
			flex-direction: column;
			gap: var(--space-2xs);
		}

		.line-quantity {
			text-align: start;
		}

		.confirmation-actions {
			display: grid;
		}

		.confirmation-actions :global(a) {
			width: 100%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.confirmation-actions :global(.button-primary),
		.confirmation-actions :global(.button-secondary) {
			transition: none;
		}
	}

	@media (forced-colors: active) {
		.confirmation-stage,
		.confirmation-layout,
		.paid-card,
		.recovery-card,
		.confirmation-status,
		.confirmation-record,
		.confirmation-record > div + div,
		.order-details ol,
		.order-details li,
		.manual-note,
		.pickup-rail {
			border-color: CanvasText;
		}

		.confirmation-stage,
		.confirmation-layout,
		.confirmation-card,
		.pickup-rail,
		.confirmation-status {
			background: Canvas;
			color: CanvasText;
		}

		.confirmation-intro > p:not(.eyebrow, .confirmation-status),
		dt,
		dd,
		.order-details li > span:first-child,
		.rail-label,
		.line-quantity,
		.manual-note {
			color: CanvasText;
		}
	}
</style>
