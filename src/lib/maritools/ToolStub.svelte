<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';

	/** @type {string} */
	export let title;

	/** @type {string} */
	export let summary;
</script>

<svelte:head>
	<title>{title} | {MARITOOLS_NAME}</title>
	<meta name="description" content={summary} />
</svelte:head>

<section class="stub page-container">
	<h1>{title}</h1>
	<p>{summary}</p>
</section>

<style>
	.stub {
		display: grid;
		padding-block: var(--space-xl);
		gap: var(--space-sm);
		max-width: 46rem;
	}

	h1 {
		font-family: var(--font-display);
		font-size: var(--text-3xl);
		line-height: 1.05;
	}
</style>
