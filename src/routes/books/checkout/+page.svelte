<script>
	import { resolve } from '$app/paths';
	import { getContext } from 'svelte';
	import CartTotals from '$lib/books/CartTotals.svelte';
	import GuestCheckoutForm from '$lib/books/GuestCheckoutForm.svelte';
	import PickupMap from '$lib/books/PickupMap.svelte';
	import { calculateCart, cartSelectionKey } from '$lib/books/cart';
	import { BOOK_CART_CONTEXT_KEY } from '$lib/books/cart-context';
	import { getOrCreateCheckoutRequestId } from '$lib/books/checkout-request';
	import { clubContent } from '$lib/content/club';

	/** @type {import('./$types').PageData} */
	export let data;
	const catalogue = data.catalogue;

	/** @type {ReturnType<typeof import('$lib/books/cart-store').createBookCartStore>} */
	const cart = getContext(BOOK_CART_CONTEXT_KEY);
	let submitting = false;
	let errorMessage = '';
	let checkoutStatus = '';
	let recoveryMessage = '';
	let reconciliationKey = '';
	/** @type {string | null} */
	let lockedCheckoutDraft = null;
	/** @type {string | null} */
	let checkoutRequestId = null;
	const booksBySelection = new Map(
		catalogue.books.map((book) => [cartSelectionKey(book.courseId, book.id), book])
	);
	const bookIdCounts = new Map();
	for (const book of catalogue.books) {
		bookIdCounts.set(book.id, (bookIdCounts.get(book.id) ?? 0) + 1);
	}
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

	async function reconcileUnavailableBooks() {
		try {
			const result = await cart.reconcile(availableBookIds);
			if (result === null) {
				recoveryMessage = "We couldn't update your cart. Return to your cart and try again.";
			} else if (result.removedCount > 0) {
				recoveryMessage = 'Some unavailable books were removed from your cart.';
			}
		} catch {
			recoveryMessage = "We couldn't update your cart. Return to your cart and try again.";
		}
	}

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
			const approvedCustomHost = data.stripeCheckoutHost;
			const approvedHost =
				url.hostname === 'checkout.stripe.com' ||
				(typeof approvedCustomHost === 'string' && url.hostname === approvedCustomHost);
			return url.protocol === 'https:' &&
				approvedHost &&
				!url.username &&
				!url.password &&
				!url.port
				? url.href
				: null;
		} catch {
			return null;
		}
	}

	function checkoutCourses() {
		const grouped = new Map();
		for (const line of summary.lines) {
			if (typeof line.courseId !== 'string') throw new Error('Course assignment is unavailable');
			const book = booksBySelection.get(cartSelectionKey(line.courseId, line.bookId));
			if (!book || typeof book.teacherSlug !== 'string') {
				throw new Error('Course assignment is unavailable');
			}
			const key = `${book.teacherSlug}\0${line.courseId}`;
			const group = grouped.get(key) ?? {
				teacherSlug: book.teacherSlug,
				courseId: line.courseId,
				items: []
			};
			group.items.push({ bookId: line.bookId, quantity: line.quantity });
			grouped.set(key, group);
		}
		return [...grouped.values()]
			.map((course) => ({
				...course,
				items: course.items.sort(
					(/** @type {{ bookId: string }} */ left, /** @type {{ bookId: string }} */ right) =>
						left.bookId.localeCompare(right.bookId)
				)
			}))
			.sort(
				(left, right) =>
					left.courseId.localeCompare(right.courseId) ||
					left.teacherSlug.localeCompare(right.teacherSlug)
			);
	}

	/** @param {CustomEvent<{ name: string, email: string }>} event */
	async function startSecureCheckout(event) {
		if (submitting) return;

		errorMessage = '';

		try {
			const courses = checkoutCourses();
			const checkoutDraft = JSON.stringify({
				courses,
				name: event.detail.name,
				email: event.detail.email
			});
			if (lockedCheckoutDraft !== null && lockedCheckoutDraft !== checkoutDraft) {
				errorMessage = 'Restore the original checkout details before retrying.';
				checkoutStatus = '';
				return;
			}
			const requestId =
				checkoutRequestId ??
				getOrCreateCheckoutRequestId({
					storage: globalThis.sessionStorage,
					crypto: globalThis.crypto
				});
			checkoutRequestId = requestId;
			lockedCheckoutDraft = checkoutDraft;
			submitting = true;
			checkoutStatus = 'Preparing secure payment.';
			const response = await fetch('/api/book-checkout', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					requestId,
					courses,
					name: event.detail.name,
					email: event.detail.email
				})
			});

			if (!response.ok) {
				if (response.status === 429) {
					errorMessage = 'Too many checkout attempts. Wait a moment, then try again.';
				} else if (response.status === 409) {
					errorMessage = 'This checkout request conflicts with an earlier attempt.';
				} else {
					errorMessage = 'We could not open secure payment. Please try again.';
				}
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
			if (!errorMessage) {
				errorMessage = 'We could not open secure payment. Please try again.';
			}
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
					<p class="cart-recovery-status" aria-live="polite" aria-atomic="true">
						{recoveryMessage}
					</p>
					<h1>Your cart is empty</h1>
					<p>Choose a course to start.</p>
					<a class="return-link" href={resolve('/books', {})}>Browse courses</a>
				</div>
			</div>
		</section>
	{:else}
		<section class="review-stage">
			<div class="checkout-layout">
				<section class="guest-workspace" aria-label="Guest checkout">
					<header class="review-intro">
						<h1 id="order-review-title">Order review</h1>
					</header>
					<p class="cart-recovery-status" aria-live="polite" aria-atomic="true">
						{recoveryMessage}
					</p>

					<GuestCheckoutForm {submitting} {errorMessage} on:submit={startSecureCheckout} />
					<p class="checkout-status" aria-live="polite" aria-atomic="true">{checkoutStatus}</p>
				</section>

				<section class="summary-rail" aria-label="Order and pickup">
					<CartTotals {summary} />
					<PickupMap />
				</section>
			</div>
		</section>
	{/if}
</div>

<style>
	.checkout-page {
		min-width: 0;
		min-height: 100%;
	}

	.cart-recovery-status {
		margin: 0;
		padding: 0 var(--page-gutter);
		color: var(--graphite);
		font-size: var(--text-sm);
		line-height: 1.5;
	}

	.cart-recovery-status:empty {
		display: none;
	}

	.empty-review {
		border-block-start: 1px solid rgb(var(--sky-rgb) / 72%);
		background: var(--paper);
	}

	.empty-review-inner {
		padding-block: clamp(3.5rem, 8vw, 6.5rem);
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

	.empty-copy > p {
		max-width: 42rem;
		color: rgb(var(--graphite-rgb) / 78%);
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
			background-color var(--motion-press) var(--ease-out),
			transform var(--motion-press) var(--ease-out);
	}

	.review-stage {
		border-block-start: 1px solid rgb(var(--sky-rgb) / 72%);
		background: var(--paper);
	}

	.checkout-layout {
		display: grid;
		width: 100%;
		min-width: 0;
	}

	.guest-workspace,
	.summary-rail,
	.review-intro {
		display: grid;
		min-width: 0;
	}

	.guest-workspace {
		align-content: start;
		padding: clamp(2rem, 5vw, 4.5rem);
		background: var(--surface-raised);
		gap: clamp(1.5rem, 2.5vw, 2rem);
	}

	.review-intro {
		gap: var(--space-sm);
	}

	.review-intro h1 {
		font-size: var(--text-3xl);
	}

	.summary-rail {
		align-content: start;
		padding: clamp(2rem, 4vw, 3.5rem);
		background: var(--midnight);
		gap: clamp(1.5rem, 2.5vw, 2rem);
	}

	.summary-rail :global(.cart-totals) {
		padding: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
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

	.return-link:active {
		transform: translateY(var(--press-distance));
		transition-duration: 0ms;
	}

	@media (hover: hover) and (pointer: fine) {
		.return-link:hover {
			background: var(--midnight);
			transform: translateY(-0.125rem);
		}
	}

	@media (min-width: 64rem) {
		.checkout-layout {
			grid-template-columns: minmax(0, 1.15fr) minmax(25rem, 0.85fr);
		}

		.summary-rail {
			border-inline-start: 1px solid rgb(var(--sky-rgb) / 32%);
		}
	}

	@media (max-width: 63.999rem) {
		.summary-rail {
			border-block-start: 1px solid rgb(var(--sky-rgb) / 32%);
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

		.return-link:hover,
		.return-link:active {
			transform: none;
		}
	}

	@media (forced-colors: active) {
		.empty-review,
		.empty-copy,
		.review-stage,
		.summary-rail,
		.return-link {
			border-color: CanvasText;
		}

		.guest-workspace {
			background: Canvas;
			color: CanvasText;
		}

		.summary-rail,
		.return-link {
			background: Canvas;
			color: CanvasText;
		}

		.checkout-status {
			color: CanvasText;
		}
	}
</style>
