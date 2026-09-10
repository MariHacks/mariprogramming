<script>
	import '../styles.css';
	import { page } from '$app/stores';
	import SiteFooter from '$lib/components/site/SiteFooter.svelte';
	import SiteHeader from '$lib/components/site/SiteHeader.svelte';
	import { isPblDocumentPath, isPblStudioPath } from '$lib/pbl/csp.js';

	/** @type {import('./$types').LayoutData} */
	export let data;

	$: pathname = $page.url.pathname;
	$: isStaffRoute = pathname === '/staff' || pathname.startsWith('/staff/');
	$: isPblStudio = isPblStudioPath(pathname);
	$: isPblRoute = isPblDocumentPath(pathname);
</script>

<a class="skip-link" href="#main-content">Skip to main content</a>

{#if !isStaffRoute}<SiteHeader
		{pathname}
		compactPbl={isPblRoute}
		headerAccount={data.headerAccount}
	/>{/if}

<main id="main-content" tabindex="-1">
	<slot></slot>
</main>

{#if !isStaffRoute && !isPblStudio}<SiteFooter />{/if}

<style>
	.skip-link {
		position: fixed;
		top: var(--space-xs);
		left: var(--space-xs);
		z-index: 100;
		padding: 0.65rem 0.9rem;
		border: var(--rule-strong);
		border-radius: var(--radius-xs);
		background: var(--surface-raised);
		color: var(--midnight);
		font-weight: 600;
		text-decoration: none;
		transform: translateY(calc(-100% - var(--space-lg)));
		transition: transform var(--motion-base) var(--ease-out);
	}

	.skip-link:focus {
		transform: translateY(0);
	}

	.skip-link:focus:active {
		transform: translateY(var(--press-distance));
	}
</style>
