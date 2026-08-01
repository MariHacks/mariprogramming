<script>
	import '../styles.css';
	import { page } from '$app/stores';
	import SiteFooter from '$lib/components/site/SiteFooter.svelte';
	import SiteHeader from '$lib/components/site/SiteHeader.svelte';

	$: pathname = $page.url.pathname;
</script>

<a class="skip-link" href="#main-content">Skip to main content</a>

<SiteHeader {pathname} />

<main id="main-content" tabindex="-1">
	<slot></slot>
</main>

<SiteFooter />

<style>
	.skip-link {
		position: fixed;
		top: var(--space-xs);
		left: var(--space-xs);
		z-index: 100;
		padding: 0.65rem 0.9rem;
		border-radius: var(--radius-sm);
		background: var(--paper);
		box-shadow: var(--shadow-sm);
		color: var(--midnight);
		font-weight: 600;
		text-decoration: none;
		transform: translateY(calc(-100% - var(--space-lg)));
		transition: transform var(--motion-fast) var(--ease-out);
	}

	.skip-link:focus {
		transform: translateY(0);
	}
</style>
