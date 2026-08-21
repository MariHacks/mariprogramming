<script>
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { openEmailedOrder } from './access.js';

	let failed = false;

	onMount(() => {
		void openEmailedOrder({ location: window.location, history: window.history }).then((opened) => {
			failed = !opened;
		});
	});
</script>

<svelte:head>
	<title>Opening your order | Marianopolis Programming Club</title>
	<meta name="robots" content="noindex, nofollow" />
	<meta name="referrer" content="no-referrer" />
</svelte:head>

<main class="access-page">
	<p class="eyebrow">Book Delivery</p>
	{#if failed}
		<h1>We couldn't open this order</h1>
		<p>The link may have expired. Reply to your confirmation email and the club team can help.</p>
		<a href={resolve('/', {})}>Return home</a>
	{:else}
		<h1>Opening your order</h1>
		<p>This should only take a moment.</p>
	{/if}
</main>

<style>
	.access-page {
		min-height: calc(100vh - 9.5rem);
		padding: clamp(4rem, 12vw, 9rem) max(1rem, calc((100vw - 90rem) / 2));
		background: #f8fafc;
		color: #07182f;
	}

	.eyebrow {
		margin: 0 0 1rem;
		color: #0759d8;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	h1 {
		max-width: 14ch;
		margin: 0;
		font-family: 'Inter Tight', 'Inter', sans-serif;
		font-size: clamp(2.5rem, 7vw, 5rem);
		line-height: 0.98;
	}

	p:not(.eyebrow) {
		max-width: 38rem;
		margin: 1.5rem 0;
		font-size: 1rem;
		line-height: 1.6;
	}

	a {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		color: #0759d8;
		font-weight: 700;
	}
</style>
