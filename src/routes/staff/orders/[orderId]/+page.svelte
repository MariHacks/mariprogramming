<script>
	import { afterUpdate } from 'svelte';
	import { applyAction, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { formatCad } from '$lib/format';

	/** @type {any} */
	export let data;
	/** @type {any} */
	export let form = null;

	const statusLabels = Object.freeze({
		pending: 'Pending',
		paid: 'Paid',
		partially_refunded: 'Partially refunded',
		refunded: 'Refunded',
		expired: 'Expired',
		failed: 'Failed',
		cancelled: 'Cancelled',
		unstarted: 'Unstarted',
		purchasing: 'Purchasing',
		received: 'Received',
		ready_for_pickup: 'Ready for pickup',
		picked_up: 'Picked up'
	});
	const actionLabels = Object.freeze({
		order_created: 'Order created',
		checkout_session_ready: 'Checkout opened',
		checkout_payment_intent_attached: 'Payment started',
		checkout_creation_failed: 'Checkout failed',
		stripe_completed_applied: 'Payment confirmed',
		stripe_completed_stale: 'Payment event already handled',
		stripe_completed_rejected: 'Payment event rejected',
		stripe_expired_applied: 'Checkout expired',
		stripe_expired_stale: 'Expiry event already handled',
		stripe_expired_rejected: 'Expiry event rejected',
		stripe_refunded_applied: 'Refund recorded',
		stripe_refunded_stale: 'Refund event already handled',
		stripe_refunded_rejected: 'Refund event rejected',
		staff_fulfillment_purchasing: 'Purchasing started',
		staff_fulfillment_received: 'Books received',
		staff_fulfillment_ready_for_pickup: 'Marked ready for pickup',
		staff_fulfillment_picked_up: 'Pickup completed',
		staff_order_cancelled: 'Unpaid order cancelled'
	});
	const actorLabels = Object.freeze({
		customer: 'Customer',
		staff: 'Team',
		stripe: 'Stripe',
		system: 'System',
		maintenance: 'Maintenance'
	});
	const nextActionLabels = Object.freeze({
		purchasing: 'Start purchasing',
		received: 'Mark books received',
		ready_for_pickup: 'Mark ready for pickup'
	});
	const torontoDate = new Intl.DateTimeFormat('en-CA', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'America/Toronto'
	});

	const fulfillmentFlow = Object.freeze([
		'unstarted',
		'purchasing',
		'received',
		'ready_for_pickup',
		'picked_up'
	]);

	/** @type {HTMLDivElement | undefined} */
	let errorElement;
	/** @type {any} */
	let focusedFailure = null;
	/** @type {any} */
	let enhancedForm = null;
	/** @type {any} */
	let pendingOrder = null;
	let submitting = false;

	$: if (
		pendingOrder &&
		data.order &&
		data.order.id === pendingOrder.id &&
		data.order.version >= pendingOrder.version
	) {
		pendingOrder = null;
	}
	$: order = pendingOrder ?? data.order;
	$: responseForm = enhancedForm ?? form;
	$: successMessage = responseForm?.success ? responseForm.message : '';

	afterUpdate(() => {
		if (responseForm?.errorSummary && responseForm !== focusedFailure) {
			focusedFailure = responseForm;
			errorElement?.focus();
		} else if (!responseForm?.errorSummary) {
			focusedFailure = null;
		}
	});

	/** @param {unknown} value */
	function statusLabel(value) {
		return statusLabels[/** @type {keyof typeof statusLabels} */ (value)] ?? 'Unknown';
	}

	/** @param {unknown} value */
	function actionLabel(value) {
		return actionLabels[/** @type {keyof typeof actionLabels} */ (value)] ?? 'Order updated';
	}

	/** @param {unknown} value */
	function actorLabel(value) {
		return actorLabels[/** @type {keyof typeof actorLabels} */ (value)] ?? 'System';
	}

	/** @param {unknown} value */
	function nextActionLabel(value) {
		return nextActionLabels[/** @type {keyof typeof nextActionLabels} */ (value)] ?? 'Update order';
	}

	/** @param {string} value */
	function localDate(value) {
		return torontoDate.format(new Date(value));
	}

	/** @param {string} paymentStatus @param {string} fulfillmentStatus */
	function nextAfterAdvance(paymentStatus, fulfillmentStatus) {
		if (paymentStatus !== 'paid') return null;
		const index = fulfillmentFlow.indexOf(fulfillmentStatus);
		if (index < 0) return null;
		const next = fulfillmentFlow[index + 1];
		return next && Object.hasOwn(nextActionLabels, next) ? next : null;
	}

	/** @param {any} current @param {any} patch */
	function applyOrderPatch(current, patch) {
		if (!current || !patch || typeof patch !== 'object') return current;
		const paymentStatus =
			typeof patch.paymentStatus === 'string' ? patch.paymentStatus : current.paymentStatus;
		const fulfillmentStatus =
			typeof patch.fulfillmentStatus === 'string'
				? patch.fulfillmentStatus
				: current.fulfillmentStatus;
		const version =
			Number.isSafeInteger(patch.version) && patch.version > 0 ? patch.version : current.version;
		return {
			...current,
			paymentStatus,
			fulfillmentStatus,
			version,
			nextFulfillmentStatus: nextAfterAdvance(paymentStatus, fulfillmentStatus),
			canCancel:
				paymentStatus === 'pending' && fulfillmentStatus === 'unstarted'
					? current.canCancel
					: false
		};
	}

	function enhanceMutation() {
		submitting = true;
		enhancedForm = null;
		return async (/** @type {{ result: import('@sveltejs/kit').ActionResult }} */ { result }) => {
			submitting = false;
			if (result.type === 'success' || result.type === 'failure') {
				enhancedForm = result.data;
				if (result.type === 'success' && result.data?.order) {
					pendingOrder = applyOrderPatch(pendingOrder ?? data.order, result.data.order);
				}
				try {
					await applyAction(result);
				} catch {
					// The bounded result remains visible locally.
				}
				if (result.type === 'success') {
					try {
						await invalidateAll();
					} catch {
						// The committed success remains visible and a manual reload is still available.
					}
				}
				return;
			}
			enhancedForm = { errorSummary: 'The order could not be updated. Try again.' };
		};
	}
</script>

<svelte:head>
	<title>{order ? `${order.publicReference} | Programming Club Team` : 'Order unavailable'}</title>
</svelte:head>

<section class="order-detail">
	<a class="back-link" href={resolve('/staff', {})}>Back to orders</a>

	{#if data.unavailable || !order}
		<div class="unavailable" role="alert">
			This order is unavailable right now. Return to orders and try again.
		</div>
	{:else}
		<header class="order-heading">
			<div>
				<p class="eyebrow">Order detail</p>
				<h1>{order.publicReference}</h1>
				<p>
					Created <time datetime={order.createdAt}>{localDate(order.createdAt)}</time>
				</p>
			</div>
			<div class="heading-statuses" aria-label="Current order status">
				<span class="status status-{order.paymentStatus}">{statusLabel(order.paymentStatus)}</span>
				<span class="status status-{order.fulfillmentStatus}"
					>{statusLabel(order.fulfillmentStatus)}</span
				>
			</div>
		</header>

		{#if submitting}<p class="request-status" role="status">Updating order</p>{/if}
		{#if successMessage && !submitting}
			<p class="request-status success" role="status">{successMessage}</p>
		{/if}
		{#if responseForm?.errorSummary}
			<div
				class="message-error"
				role="alert"
				aria-live="assertive"
				aria-atomic="true"
				tabindex="-1"
				bind:this={errorElement}
			>
				{responseForm.errorSummary}
			</div>
		{/if}

		<div class="detail-layout">
			<main class="receipt-column">
				<section class="receipt" aria-labelledby="receipt-title">
					<header class="section-heading">
						<div>
							<p class="utility-label">Saved at checkout</p>
							<h2 id="receipt-title">Receipt snapshot</h2>
						</div>
					</header>

					{#each order.bookstores as bookstore (bookstore.id)}
						<section class="bookstore-group" aria-labelledby={`bookstore-${bookstore.id}`}>
							<h3 id={`bookstore-${bookstore.id}`}>{bookstore.name}</h3>
							<ul>
								{#each bookstore.lines as line (line.id)}
									<li class:service-fee={line.kind === 'service_fee'}>
										<div class="line-description">
											<strong>{line.label}</strong>
											{#if line.kind === 'book'}
												<p>{line.courseCode}, {line.courseTitle}</p>
												<p>{line.teacherName}</p>
												{#if line.isbn}<p>ISBN {line.isbn}</p>{/if}
												{#if line.currentRetailerUrl}
													<!-- eslint-disable svelte/no-navigation-without-resolve -->
													<a
														href={line.currentRetailerUrl}
														target="_blank"
														rel="noreferrer noopener"
														aria-label={`View current retailer listing for ${line.label}`}
														>View current retailer listing</a
													>
													<!-- eslint-enable svelte/no-navigation-without-resolve -->
												{/if}
											{/if}
										</div>
										<div class="line-money">
											<span>{line.quantity} at {formatCad(line.unitAmountCents)}</span>
											<strong>{formatCad(line.lineAmountCents)}</strong>
										</div>
									</li>
								{/each}
							</ul>
						</section>
					{/each}

					<dl class="totals">
						<div>
							<dt>Books</dt>
							<dd>{formatCad(order.subtotalCents)}</dd>
						</div>
						<div>
							<dt>Service fees</dt>
							<dd>{formatCad(order.serviceFeeCents)}</dd>
						</div>
						<div>
							<dt>Tax</dt>
							<dd>{formatCad(order.taxCents)}</dd>
						</div>
						{#if order.refundedAmountCents > 0}
							<div>
								<dt>Refunded</dt>
								<dd>{formatCad(order.refundedAmountCents)}</dd>
							</div>
						{/if}
						<div class="total">
							<dt>Total</dt>
							<dd>{formatCad(order.totalCents)}</dd>
						</div>
					</dl>
				</section>

				<section class="history" aria-labelledby="history-title">
					<header class="section-heading">
						<h2 id="history-title">Order history</h2>
					</header>
					{#if order.history.length === 0}
						<p class="empty-history">No history recorded.</p>
					{:else}
						<ol>
							{#each order.history as entry (entry.id)}
								<li>
									<div>
										<strong>{actionLabel(entry.action)}</strong>
										<span>{actorLabel(entry.actorKind)}</span>
									</div>
									<time datetime={entry.createdAt}>{localDate(entry.createdAt)}</time>
								</li>
							{/each}
						</ol>
					{/if}
				</section>
			</main>

			<aside class="operations-column" aria-label="Order operations">
				{#if order.nextFulfillmentStatus}
					<section class="next-action">
						<p class="utility-label">Next step</p>
						<h2>{statusLabel(order.nextFulfillmentStatus)}</h2>
						<form method="post" action="?/advance" use:enhance={enhanceMutation}>
							<input type="hidden" name="version" value={order.version} />
							<button
								class="primary-action"
								type="submit"
								formaction="?/advance"
								disabled={submitting}>{nextActionLabel(order.nextFulfillmentStatus)}</button
							>
						</form>
					</section>
				{/if}

				<section class="customer" aria-labelledby="customer-title">
					<p class="utility-label">Protected customer data</p>
					<h2 id="customer-title">Customer</h2>
					<dl>
						<div>
							<dt>Name</dt>
							<dd>{order.customer.name}</dd>
						</div>
						<div>
							<dt>Email</dt>
							<dd>{order.customer.email}</dd>
						</div>
					</dl>
				</section>

				<section class="provider" aria-labelledby="provider-title">
					<p class="utility-label">Stripe lookup</p>
					<h2 id="provider-title">Payment IDs</h2>
					<dl>
						<div>
							<dt>Checkout Session</dt>
							<dd><code>{order.provider.checkoutSessionId ?? 'Not assigned'}</code></dd>
						</div>
						<div>
							<dt>PaymentIntent</dt>
							<dd><code>{order.provider.paymentIntentId ?? 'Not assigned'}</code></dd>
						</div>
						<div>
							<dt>Charge</dt>
							<dd><code>{order.provider.chargeId ?? 'Not assigned'}</code></dd>
						</div>
					</dl>
				</section>

				{#if order.canCancel}
					<section class="cancel-order" aria-labelledby="cancel-title">
						<h2 id="cancel-title">Cancel unpaid order</h2>
						<p>This closes the unpaid checkout. It does not issue a Stripe refund.</p>
						<form method="post" action="?/cancel" use:enhance={enhanceMutation}>
							<input type="hidden" name="version" value={order.version} />
							<button type="submit" formaction="?/cancel" disabled={submitting}
								>Confirm cancellation</button
							>
						</form>
					</section>
				{/if}
			</aside>
		</div>
	{/if}
</section>

<style>
	.order-detail {
		width: 100%;
		padding: 1.25rem var(--page-gutter) 5rem;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		color: var(--club-blue);
		font-size: 0.875rem;
		font-weight: 650;
		text-decoration: none;
	}

	.back-link::before {
		content: '←';
		margin-right: 0.45rem;
	}

	.unavailable,
	.message-error,
	.request-status {
		margin-top: 1rem;
		padding: 0.9rem 1rem;
		border: var(--rule);
		font-size: 0.875rem;
	}

	.unavailable,
	.message-error {
		border-color: var(--danger);
		background: #fff5f6;
		color: #78142a;
	}

	.request-status {
		background: rgb(var(--sky-rgb) / 24%);
	}

	.request-status.success {
		border-color: #087653;
		background: #eefaf5;
		color: #075e41;
	}

	.order-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1.25rem;
		padding: 1rem 0 1.15rem;
		border-bottom: var(--rule-strong);
	}

	.order-heading h1 {
		margin-top: 0.2rem;
		font-family: var(--font-mono);
		font-size: clamp(1.35rem, 2.4vw, 1.75rem);
		letter-spacing: -0.03em;
		line-height: 1.15;
	}

	.order-heading p:not(.eyebrow) {
		margin-top: 0.4rem;
		color: var(--color-muted);
		font-size: 0.8125rem;
	}

	.heading-statuses {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.status {
		padding: 0.3rem 0.55rem;
		border: 1px solid currentColor;
		color: var(--midnight);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		line-height: 1.3;
		text-transform: uppercase;
	}

	.status-paid,
	.status-ready_for_pickup {
		color: #075e41;
	}

	.status-partially_refunded,
	.status-refunded,
	.status-failed,
	.status-cancelled {
		color: #8d1b32;
	}

	.detail-layout {
		display: grid;
		grid-template-columns: minmax(0, 1.75fr) minmax(17rem, 0.75fr);
		gap: clamp(2rem, 5vw, 5rem);
		align-items: start;
		padding-top: clamp(2rem, 4vw, 3.5rem);
	}

	.receipt-column,
	.operations-column {
		min-width: 0;
	}

	.section-heading {
		padding-bottom: 1rem;
		border-bottom: var(--rule-strong);
	}

	.section-heading h2,
	.operations-column h2 {
		margin-top: 0.35rem;
		font-size: 1.35rem;
		letter-spacing: -0.025em;
	}

	.bookstore-group {
		border-bottom: var(--rule-strong);
	}

	.bookstore-group h3 {
		padding: 1rem 0 0.75rem;
		font-family: var(--font-body);
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.bookstore-group ul,
	.history ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.bookstore-group li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 2rem;
		padding: 1.1rem 0;
		border-top: var(--rule);
	}

	.line-description {
		display: grid;
		gap: 0.25rem;
		min-width: 0;
	}

	.line-description strong {
		color: var(--midnight);
		line-height: 1.35;
	}

	.line-description p,
	.line-money span {
		color: var(--color-muted);
		font-size: 0.8125rem;
	}

	.line-description a {
		width: fit-content;
		min-height: 2.75rem;
		padding-top: 0.55rem;
		font-size: 0.8125rem;
	}

	.line-money {
		display: grid;
		align-content: start;
		gap: 0.2rem;
		text-align: right;
	}

	.line-money strong,
	.totals dd {
		font-variant-numeric: tabular-nums;
	}

	.service-fee .line-description strong {
		font-weight: 600;
	}

	.totals {
		width: min(100%, 25rem);
		margin: 1.25rem 0 0 auto;
	}

	.totals div {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		padding: 0.45rem 0;
		font-size: 0.875rem;
	}

	.totals dt {
		color: var(--color-muted);
	}

	.totals .total {
		margin-top: 0.45rem;
		padding-top: 0.85rem;
		border-top: var(--rule-strong);
		color: var(--midnight);
		font-size: 1rem;
		font-weight: 700;
	}

	.history {
		margin-top: 3.5rem;
	}

	.history li {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 2rem;
		padding: 0.9rem 0;
		border-bottom: var(--rule);
	}

	.history li div {
		display: grid;
		gap: 0.2rem;
	}

	.history li span,
	.history time,
	.empty-history {
		color: var(--color-muted);
		font-size: 0.8125rem;
	}

	.empty-history {
		padding: 1rem 0;
		border-bottom: var(--rule);
	}

	.operations-column {
		position: sticky;
		top: 1.5rem;
		border-top: var(--rule-strong);
	}

	.operations-column section {
		padding: 1.25rem 0;
		border-bottom: var(--rule-strong);
	}

	.next-action {
		background: var(--midnight);
		color: white;
		padding-inline: 1.25rem !important;
	}

	.next-action :is(.utility-label, h2) {
		color: white;
	}

	.primary-action,
	.cancel-order button {
		width: 100%;
		min-height: 3rem;
		margin-top: 1.25rem;
		padding: 0.75rem 1rem;
		border: 1px solid transparent;
		border-radius: 0;
		font: inherit;
		font-size: 0.875rem;
		font-weight: 700;
		cursor: pointer;
	}

	.primary-action {
		border-color: white;
		background: white;
		color: var(--midnight);
	}

	.primary-action:disabled,
	.cancel-order button:disabled {
		cursor: wait;
		opacity: 0.55;
	}

	.customer dl,
	.provider dl {
		margin-top: 1rem;
	}

	.customer dl div,
	.provider dl div {
		display: grid;
		gap: 0.15rem;
		padding: 0.55rem 0;
	}

	.customer dt,
	.provider dt {
		color: var(--color-muted);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}

	.customer dd,
	.provider dd {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.provider code {
		user-select: all;
	}

	.cancel-order h2 {
		color: var(--danger);
	}

	.cancel-order p {
		margin-top: 0.65rem;
		color: var(--color-muted);
		font-size: 0.875rem;
	}

	.cancel-order button {
		border-color: var(--danger);
		background: transparent;
		color: var(--danger);
	}

	@media (max-width: 62rem) {
		.detail-layout {
			grid-template-columns: minmax(0, 1fr);
		}

		.operations-column {
			position: static;
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 0 2rem;
		}

		.next-action,
		.cancel-order {
			grid-column: 1 / -1;
		}
	}

	@media (max-width: 40rem) {
		.order-heading {
			align-items: flex-start;
			flex-direction: column;
		}

		.heading-statuses {
			justify-content: flex-start;
		}

		.bookstore-group li {
			grid-template-columns: minmax(0, 1fr);
			gap: 0.75rem;
		}

		.line-money {
			grid-template-columns: 1fr auto;
			text-align: left;
		}

		.operations-column {
			display: block;
		}

		.history li {
			align-items: flex-start;
			flex-direction: column;
			gap: 0.4rem;
		}
	}

	@media (max-width: 24rem) {
		.order-detail {
			padding-inline: 0.75rem;
		}

		.order-heading h1 {
			font-size: 1.75rem;
			word-break: break-word;
		}
	}

	@media (forced-colors: active) {
		.status,
		.primary-action,
		.cancel-order button {
			border-color: ButtonText;
		}
	}
</style>
