<script>
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { createClubContactLinks } from '$lib/club-contact.js';

	const contact = createClubContactLinks();
	const reference = page.url.searchParams.get('reference') ?? '';
</script>

<svelte:head>
	<title>Request received | Marianopolis Programming Club</title>
</svelte:head>

<section class="page-shell received-page" aria-labelledby="received-heading">
	<p class="section-kicker">Book Delivery</p>
	<h1 id="received-heading">We received your request</h1>
	{#if reference}
		<p class="lede">
			Your request number is <strong>{reference}</strong>. Keep it if you write us about this
			request.
		</p>
	{:else}
		<p class="lede">Your request is in. Keep any confirmation we emailed you.</p>
	{/if}
	<p>
		Questions: <a href={contact.inquiry.href} rel="external">{contact.inquiry.label}</a>.
	</p>
	<p>
		<a class="text-link" href={resolve('/books', {})}>Back to the book catalogue</a>
	</p>
</section>

<style>
	.received-page {
		display: grid;
		gap: 1rem;
		padding-block: 2.5rem 4rem;
	}
</style>
