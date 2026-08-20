<script>
	import { afterUpdate } from 'svelte';
	import { applyAction, enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { formatCad } from '$lib/format';
	import { ageTone, formatAge } from '$lib/shared/age.js';

	/** @type {any} */
	export let data;
	/** @type {any} */
	export let form = null;

	const paymentOptions = Object.freeze([
		['actionable', 'Actionable'],
		['all', 'All payments'],
		['pending', 'Pending'],
		['paid', 'Paid'],
		['partially_refunded', 'Partially refunded'],
		['refunded', 'Refunded'],
		['expired', 'Expired'],
		['failed', 'Failed'],
		['cancelled', 'Cancelled']
	]);
	const fulfillmentOptions = Object.freeze([
		['all', 'All fulfillment'],
		['unstarted', 'Unstarted'],
		['purchasing', 'Purchasing'],
		['received', 'Received'],
		['ready_for_pickup', 'Ready for pickup'],
		['picked_up', 'Picked up']
	]);
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
	const torontoDate = new Intl.DateTimeFormat('en-CA', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'America/Toronto'
	});

	/** @type {HTMLDivElement | undefined} */
	let errorElement;
	/** @type {any} */
	let focusedFailure = null;
	/** @type {any} */
	let enhancedForm = null;
	let searching = false;

	$: responseForm = enhancedForm ?? form;
	$: searchResult = responseForm?.success && responseForm.search ? responseForm.search : null;
	$: visibleListing = searchResult ?? data.listing;
	$: resultLabel = `${visibleListing.totalCount} ${visibleListing.totalCount === 1 ? 'order' : 'orders'}`;

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

	/** @param {string} value */
	function localDate(value) {
		return torontoDate.format(new Date(value));
	}

	/** @param {number} page */
	function ledgerQuery(page) {
		const query = new URLSearchParams({
			payment: data.listing.filters.payment,
			fulfillment: data.listing.filters.fulfillment,
			page: String(page)
		});
		return `?${query}`;
	}

	function enhanceSearch() {
		searching = true;
		enhancedForm = null;
		return async (/** @type {{ result: import('@sveltejs/kit').ActionResult }} */ { result }) => {
			searching = false;
			if (result.type === 'success' || result.type === 'failure') {
				enhancedForm = result.data;
				try {
					await applyAction(result);
				} catch {
					// The protected result is already rendered locally.
				}
				return;
			}
			enhancedForm = { errorSummary: 'The search could not be completed. Try again.' };
		};
	}
</script>

<svelte:head>
	<title>Orders | Programming Club Staff</title>
</svelte:head>

<section class="orders-workspace">
	<header class="page-heading">
		<div>
			<p class="eyebrow">Book delivery operations</p>
			<h1>Orders</h1>
			<p class="heading-note">Paid orders waiting for purchase or pickup.</p>
		</div>
		<form method="post" action={resolve('/staff/orders/export', {})}>
			<input type="hidden" name="intent" value="purchase_list" />
			<button class="export-button" type="submit">Download purchase list</button>
		</form>
	</header>

	<div class="controls">
		<form class="filters" method="get" action={resolve('/staff', {})}>
			<label>
				<span>Payment</span>
				<select name="payment" value={data.listing.filters.payment}>
					{#each paymentOptions as option (option[0])}
						<option value={option[0]}>{option[1]}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Fulfillment</span>
				<select name="fulfillment" value={data.listing.filters.fulfillment}>
					{#each fulfillmentOptions as option (option[0])}
						<option value={option[0]}>{option[1]}</option>
					{/each}
				</select>
			</label>
			<input type="hidden" name="page" value="1" />
			<button class="filter-button" type="submit">Apply filters</button>
		</form>

		<form class="order-search" method="post" action="?/search" use:enhance={enhanceSearch}>
			<label for="order-search">Order reference or customer email</label>
			<div class="search-control">
				<input
					id="order-search"
					type="search"
					name="query"
					autocomplete="off"
					spellcheck="false"
					required
					value={searchResult?.query ?? ''}
				/>
				<input type="hidden" name="page" value="1" />
				<button type="submit" disabled={searching}>Find order</button>
			</div>
		</form>
	</div>

	{#if searching}<p class="request-status" role="status">Searching</p>{/if}
	{#if responseForm?.errorSummary}
		<div
			class="message message-error"
			role="alert"
			aria-live="assertive"
			aria-atomic="true"
			tabindex="-1"
			bind:this={errorElement}
		>
			{responseForm.errorSummary}
		</div>
	{/if}
	{#if data.unavailable}
		<div class="message message-error" role="alert">
			Orders are unavailable right now. Reload this page to try again.
		</div>
	{:else}
		<section class="ledger" aria-labelledby={searchResult ? 'search-results-title' : 'queue-title'}>
			<header class="ledger-heading">
				<div>
					<h2 id={searchResult ? 'search-results-title' : 'queue-title'}>
						{searchResult ? 'Exact match' : 'Actionable queue'}
					</h2>
					{#if searchResult}
						<p>
							{visibleListing.totalCount}
							{visibleListing.totalCount === 1 ? 'result' : 'results'}
						</p>
					{:else}
						<p>{resultLabel}</p>
					{/if}
				</div>
				{#if searchResult}
					<a href={resolve('/staff', {})}>Clear search</a>
				{/if}
			</header>

			{#if visibleListing.orders.length === 0}
				<p class="empty-state">
					{searchResult ? 'No exact match found.' : 'No orders match these filters.'}
				</p>
			{:else}
				<div class="order-columns" aria-hidden="true">
					<span>Order</span>
					<span>Payment</span>
					<span>Fulfillment</span>
					<span>Total</span>
					<span>Created</span>
					<span></span>
				</div>
				<ol class="order-list">
					{#each visibleListing.orders as order (order.id)}
						<li>
							<div class="order-identity">
								<strong>{order.publicReference}</strong>
								<span>{order.maskedEmail}</span>
							</div>
							<div class="order-cell">
								<span class="cell-label">Payment</span>
								<span class="status status-{order.paymentStatus}"
									>{statusLabel(order.paymentStatus)}</span
								>
							</div>
							<div class="order-cell">
								<span class="cell-label">Fulfillment</span>
								<span class="status status-{order.fulfillmentStatus}"
									>{statusLabel(order.fulfillmentStatus)}</span
								>
							</div>
							<div class="order-cell amount">
								<span class="cell-label">Total</span>
								<strong>{formatCad(order.totalCents)}</strong>
							</div>
							<div class="order-cell created">
								<span class="cell-label">Created</span>
								<time datetime={order.createdAt}>{localDate(order.createdAt)}</time>
								<span class="age age-{ageTone(order.ageSeconds)}"
									>{formatAge(order.ageSeconds)}</span
								>
							</div>
							<a
								class="open-order"
								href={resolve('/staff/orders/[orderId]', { orderId: order.id })}
								aria-label={`Open ${order.publicReference}`}>Open</a
							>
						</li>
					{/each}
				</ol>
			{/if}

			{#if visibleListing.hasPrevious || visibleListing.hasNext}
				<nav class="pagination" aria-label={searchResult ? 'Search pages' : 'Order pages'}>
					{#if searchResult}
						{#if visibleListing.hasPrevious}
							<form method="post" action="?/search">
								<input type="hidden" name="query" value={searchResult.query} />
								<input type="hidden" name="page" value={visibleListing.page - 1} />
								<button type="submit" aria-label="Previous search page">Previous</button>
							</form>
						{/if}
						<span>Page {visibleListing.page}</span>
						{#if visibleListing.hasNext}
							<form method="post" action="?/search">
								<input type="hidden" name="query" value={searchResult.query} />
								<input type="hidden" name="page" value={visibleListing.page + 1} />
								<button type="submit" aria-label="Next search page">Next</button>
							</form>
						{/if}
					{:else}
						{#if visibleListing.hasPrevious}
							<!-- eslint-disable svelte/no-navigation-without-resolve -->
							<a
								href={resolve('/staff', {}) + ledgerQuery(visibleListing.page - 1)}
								aria-label="Previous page">Previous</a
							>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{/if}
						<span>Page {visibleListing.page}</span>
						{#if visibleListing.hasNext}
							<!-- eslint-disable svelte/no-navigation-without-resolve -->
							<a
								href={resolve('/staff', {}) + ledgerQuery(visibleListing.page + 1)}
								aria-label="Next page">Next</a
							>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{/if}
					{/if}
				</nav>
			{/if}
		</section>
	{/if}
</section>

<style>
	.orders-workspace {
		width: 100%;
		padding: clamp(2rem, 5vw, 4.5rem) var(--page-gutter) 5rem;
	}

	.page-heading,
	.ledger-heading,
	.controls,
	.filters,
	.search-control,
	.pagination {
		display: flex;
		align-items: center;
	}

	.page-heading {
		justify-content: space-between;
		gap: 2rem;
		padding-bottom: clamp(1.5rem, 3vw, 2.5rem);
		border-bottom: var(--rule-strong);
	}

	.page-heading h1 {
		margin-top: 0.4rem;
		font-size: clamp(2.5rem, 6vw, 5.5rem);
		letter-spacing: -0.055em;
		line-height: 0.95;
	}

	.heading-note {
		margin-top: 0.8rem;
		color: var(--color-muted);
	}

	.export-button,
	.filter-button,
	.search-control button,
	.pagination :is(a, button) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.75rem;
		padding: 0.65rem 0.9rem;
		border: var(--rule-strong);
		border-radius: 0;
		font: inherit;
		font-size: 0.875rem;
		font-weight: 650;
		text-decoration: none;
		cursor: pointer;
	}

	.export-button,
	.search-control button {
		border-color: var(--midnight);
		background: var(--midnight);
		color: white;
	}

	.controls {
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		padding-block: 1.25rem;
		border-bottom: var(--rule);
	}

	.filters {
		align-items: end;
		gap: 0.65rem;
	}

	.filters label,
	.order-search > label {
		display: grid;
		gap: 0.35rem;
		color: var(--color-muted);
		font-size: 0.75rem;
		font-weight: 650;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.filters select {
		min-width: 10rem;
		min-height: 2.75rem;
		border-radius: 0;
		background: white;
		font-size: 0.875rem;
	}

	.filter-button,
	.pagination :is(a, button) {
		background: white;
		color: var(--midnight);
	}

	.order-search {
		width: min(100%, 29rem);
	}

	.search-control {
		margin-top: 0.35rem;
	}

	.search-control input {
		min-height: 2.75rem;
		border-radius: 0;
		background: white;
	}

	.search-control button {
		flex: 0 0 auto;
	}

	.request-status,
	.message {
		padding: 0.85rem 1rem;
		border-bottom: var(--rule);
		font-size: 0.875rem;
	}

	.request-status {
		background: rgb(var(--sky-rgb) / 24%);
	}

	.message-error {
		border: 1px solid var(--danger);
		background: #fff5f6;
		color: #78142a;
	}

	.ledger-heading {
		justify-content: space-between;
		gap: 1rem;
		padding: 1.5rem 0 1rem;
	}

	.ledger-heading h2 {
		font-size: 1.25rem;
		letter-spacing: -0.02em;
	}

	.ledger-heading p {
		margin-top: 0.3rem;
		color: var(--color-muted);
		font-size: 0.875rem;
	}

	.ledger-heading a {
		min-height: 2.75rem;
		padding: 0.65rem 0;
	}

	.order-columns,
	.order-list li {
		display: grid;
		grid-template-columns:
			minmax(12rem, 1.45fr) minmax(7rem, 0.75fr) minmax(9rem, 0.9fr) minmax(5.5rem, 0.55fr)
			minmax(10rem, 1fr) 4rem;
		gap: 1rem;
		align-items: center;
	}

	.order-columns {
		padding: 0.65rem 0;
		border-top: var(--rule-strong);
		border-bottom: var(--rule);
		color: var(--color-muted);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}

	.order-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.order-list li {
		min-height: 5.75rem;
		padding-block: 1rem;
		border-bottom: var(--rule);
		transition: background-color var(--motion-fast) var(--ease-out);
	}

	.order-list li:hover {
		background: rgb(var(--sky-rgb) / 11%);
	}

	.order-identity,
	.order-cell,
	.created {
		display: grid;
		gap: 0.18rem;
		min-width: 0;
	}

	.order-identity strong {
		font-family: var(--font-mono);
		font-size: 0.875rem;
	}

	.order-identity span,
	.created span,
	.created time {
		color: var(--color-muted);
		font-size: 0.75rem;
	}

	.age-aging {
		color: var(--coral);
	}

	.age-overdue {
		color: var(--danger);
	}

	.cell-label {
		display: none;
		color: var(--color-muted);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}

	.status {
		width: fit-content;
		padding: 0.2rem 0.45rem;
		border: 1px solid currentColor;
		color: var(--midnight);
		font-size: 0.6875rem;
		font-weight: 700;
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

	.amount strong {
		font-variant-numeric: tabular-nums;
	}

	.open-order {
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		min-height: 2.75rem;
		color: var(--club-blue);
		font-size: 0.875rem;
		font-weight: 650;
		text-decoration: none;
	}

	.empty-state {
		padding: 2.5rem 0;
		border-top: var(--rule-strong);
		border-bottom: var(--rule);
		color: var(--color-muted);
	}

	.pagination {
		justify-content: flex-end;
		gap: 0.75rem;
		padding-top: 1.25rem;
	}

	.pagination span {
		color: var(--color-muted);
		font-size: 0.8125rem;
	}

	@media (max-width: 72rem) {
		.controls {
			align-items: stretch;
			flex-direction: column;
		}

		.order-search {
			width: 100%;
		}

		.order-columns {
			display: none;
		}

		.order-list li {
			grid-template-columns:
				minmax(12rem, 1.4fr) repeat(2, minmax(8rem, 0.8fr)) minmax(6rem, 0.55fr)
				4rem;
		}

		.created {
			grid-column: 1 / -1;
			grid-row: 2;
		}
	}

	@media (max-width: 48rem) {
		.page-heading {
			align-items: flex-start;
			flex-direction: column;
		}

		.filters {
			display: grid;
			grid-template-columns: 1fr 1fr;
		}

		.filter-button {
			grid-column: 1 / -1;
		}

		.filters select {
			min-width: 0;
		}

		.order-list li {
			grid-template-columns: 1fr 1fr;
			gap: 1rem;
		}

		.order-identity,
		.created,
		.open-order {
			grid-column: 1 / -1;
		}

		.created {
			grid-row: auto;
		}

		.cell-label {
			display: block;
		}

		.open-order {
			justify-content: flex-start;
			width: fit-content;
		}
	}

	@media (max-width: 24rem) {
		.orders-workspace {
			padding-inline: 0.75rem;
		}

		.filters {
			grid-template-columns: 1fr;
		}

		.filter-button {
			grid-column: auto;
		}

		.search-control {
			align-items: stretch;
			flex-direction: column;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.order-list li {
			transition: none;
		}
	}

	@media (forced-colors: active) {
		.status,
		.export-button,
		.filter-button,
		.search-control button,
		.pagination :is(a, button) {
			border-color: ButtonText;
		}
	}
</style>
