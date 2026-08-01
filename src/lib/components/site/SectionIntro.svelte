<script>
	/** @type {string} */
	export let title;

	/** @type {string} */
	export let eyebrow = '';

	/** @type {string} */
	export let summary = '';
</script>

<header class="section-intro">
	{#if eyebrow}
		<p class="eyebrow">{eyebrow}</p>
	{/if}

	<h1>{title}</h1>

	{#if summary}
		<p class="summary">{summary}</p>
	{/if}
</header>

<style>
	.section-intro {
		display: grid;
		width: 100%;
		min-width: 0;
		gap: var(--space-sm);
	}

	h1 {
		max-width: 20ch;
		overflow-wrap: break-word;
	}

	.summary {
		max-width: 58ch;
		font-size: var(--text-lg);
		line-height: 1.55;
		text-wrap: pretty;
	}
</style>
