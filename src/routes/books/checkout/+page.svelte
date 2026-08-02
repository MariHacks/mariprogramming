<script>
	import { getContext } from 'svelte';
	import CartTotals from '$lib/books/CartTotals.svelte';
	import GuestCheckoutForm from '$lib/books/GuestCheckoutForm.svelte';
	import PickupMap from '$lib/books/PickupMap.svelte';
	import { calculateCart } from '$lib/books/cart';
	import { BOOK_CART_CONTEXT_KEY } from '$lib/books/cart-context';
	import { catalogue } from '$lib/books/catalogue';
	import { clubContent } from '$lib/content/club';

	/** @type {ReturnType<typeof import('$lib/books/cart-store').createBookCartStore>} */
	const cart = getContext(BOOK_CART_CONTEXT_KEY);
	let submitting = false;
	let errorMessage = '';
	let checkoutStatus = '';

	$: summary = calculateCart(catalogue, $cart);

	/**
	 * Browser redirects may only use a complete, credential-free HTTPS address.
	 *
	 * @param {unknown} value
	 * @returns {string | null}
	 */
	function getSecureRedirectUrl(value) {
		if (typeof value !== 'string' || !value || value.length > 2000) {
			return null;
		}

		try {
			const url = new URL(value);
			return url.protocol === 'https:' && url.hostname && !url.username && !url.password
				? url.href
				: null;
		} catch {
			return null;
		}
	}

	/** @param {CustomEvent<{ name: string, email: string }>} event */
	async function startSecureCheckout(event) {
		if (submitting) return;

		submitting = true;
		errorMessage = '';
		checkoutStatus = 'Preparing secure payment.';

		try {
			const response = await fetch('/api/book-checkout', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					items: $cart.items,
					name: event.detail.name,
					email: event.detail.email
				})
			});

			if (!response.ok) {
				throw new Error('Checkout request failed');
			}

			const responseBody = await response.json();
			const redirectUrl = getSecureRedirectUrl(responseBody?.url);

			if (!redirectUrl) {
				throw new Error('Checkout redirect URL is invalid');
			}

			checkoutStatus = 'Opening secure payment.';
			globalThis.location.assign(redirectUrl);
		} catch {
			errorMessage = 'We could not open secure payment. Please try again.';
			checkoutStatus = '';
		} finally {
			submitting = false;
		}
	}

	const metaDescription =
		'Review your Book Delivery cart, pickup details, and guest contact before continuing to secure payment.';
</script>

<svelte:head>
	<title>Order review | {clubContent.name}</title>
	<meta name="description" content={metaDescription} />
</svelte:head>

<div class="checkout-page surface-paper">
	{#if summary.lines.length === 0}
		<section class="empty-review">
			<div class="page-container empty-review-inner">
				<div class="empty-copy">
					<p class="eyebrow">Book Delivery</p>
					<h1>Your cart is empty</h1>
					<p>Add your course books before starting an order review.</p>
					<a class="return-link" href="/books/cart">Return to cart</a>
				</div>
			</div>
		</section>
	{:else}
		<section class="review-stage" aria-label="Order review workspace">
			<div class="page-container review-stage-inner">
				<div class="checkout-layout">
					<section class="guest-workspace" aria-labelledby="order-review-title">
						<header class="review-intro">
							<p class="eyebrow">Book Delivery</p>
							<h1 id="order-review-title">Order review</h1>
							<p>Confirm your pickup name and receipt email, then continue to secure payment.</p>
						</header>

						<GuestCheckoutForm {submitting} {errorMessage} on:submit={startSecureCheckout} />
						<p class="checkout-status" aria-live="polite" aria-atomic="true">{checkoutStatus}</p>
					</section>

					<div class="summary-rail">
						<p class="rail-label">Review estimate</p>
						<CartTotals {summary} />
						<PickupMap />
					</div>
				</div>
			</div>
		</section>
	{/if}
</div>

<style>
	.checkout-page {
		min-width: 0;
		min-height: 100%;
	}

	.empty-review {
		display: grid;
		min-height: calc(100vh - 3.75rem);
		align-items: center;
		border-block-start: 0.375rem solid var(--sky);
	}

	.empty-review-inner {
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
	.review-intro h1 {
		max-width: 13ch;
	}

	.empty-copy > p:not(.eyebrow),
	.review-intro > p:not(.eyebrow) {
		max-width: 42rem;
		color: rgb(24 27 37 / 78%);
		font-size: var(--text-lg);
		line-height: 1.55;
		text-wrap: pretty;
	}

	.return-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		justify-self: start;
		min-height: 3.25rem;
		padding: 0.85rem 1.1rem;
		border: 1px solid var(--club-blue);
		border-radius: var(--radius-xs);
		background: var(--club-blue);
		color: var(--paper);
		font-size: var(--text-sm);
		font-weight: 700;
		line-height: 1.25;
		text-align: center;
		text-decoration: none;
		transition:
			background-color var(--motion-fast) var(--ease-out),
			transform var(--motion-fast) var(--ease-out);
	}

	.review-stage {
		border-block-start: 0.375rem solid var(--sky);
		background: linear-gradient(to bottom, rgb(153 194 255 / 16%), transparent 30rem);
	}

	.review-stage-inner {
		padding-block: clamp(2rem, 5vw, 5.5rem);
	}

	.checkout-layout {
		display: grid;
		min-width: 0;
		border: 1px solid rgb(5 13 46 / 24%);
		border-radius: var(--radius-md);
		background: var(--paper);
		box-shadow: var(--shadow-md);
		overflow: hidden;
	}

	.guest-workspace,
	.summary-rail,
	.review-intro {
		display: grid;
		min-width: 0;
	}

	.guest-workspace {
		align-content: start;
		padding: clamp(1.5rem, 4vw, 3.5rem);
		background: var(--paper);
		gap: var(--space-lg);
	}

	.review-intro {
		gap: var(--space-sm);
	}

	.summary-rail {
		align-content: start;
		padding: clamp(1.25rem, 3vw, 2.5rem);
		background: var(--midnight);
		gap: var(--space-md);
	}

	.rail-label {
		margin: 0;
		color: var(--sky);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 0.1em;
		line-height: 1.35;
		text-transform: uppercase;
	}

	.checkout-status {
		min-height: 1.45em;
		margin: 0;
		color: var(--club-blue);
		font-size: var(--text-sm);
		font-weight: 600;
		line-height: 1.45;
	}

	.return-link:focus-visible {
		outline: 3px solid var(--coral);
		outline-offset: 4px;
	}

	@media (hover: hover) and (pointer: fine) {
		.return-link:hover {
			background: var(--midnight);
			transform: translateY(-0.125rem);
		}
	}

	@media (min-width: 64rem) {
		.checkout-layout {
			grid-template-columns: minmax(0, 1.12fr) minmax(23rem, 0.88fr);
		}

		.summary-rail {
			border-inline-start: 1px solid rgb(153 194 255 / 32%);
		}
	}

	@media (max-width: 40rem) {
		.summary-rail :global(.map-viewport) {
			min-height: 0;
		}
	}

	@media (max-width: 22rem) {
		.guest-workspace,
		.summary-rail {
			padding: var(--space-md);
		}

		.return-link {
			width: 100%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.return-link {
			transition: none;
		}

		.return-link:hover {
			transform: none;
		}
	}

	@media (forced-colors: active) {
		.empty-review,
		.empty-copy,
		.review-stage,
		.checkout-layout,
		.summary-rail,
		.return-link {
			border-color: CanvasText;
		}

		.checkout-layout,
		.guest-workspace {
			background: Canvas;
			color: CanvasText;
		}

		.summary-rail,
		.return-link {
			background: Canvas;
			color: CanvasText;
		}

		.rail-label,
		.checkout-status {
			color: CanvasText;
		}
	}
</style>
