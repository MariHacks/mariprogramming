<script>
	import { resolve } from '$app/paths';

	/** @type {string} */
	export let title;

	/** @type {string} */
	export let summary = '';

	/** @type {string} */
	export let href = '';

	/** @type {string} */
	export let meta = '';

	/** @type {'paper' | 'navy'} */
	export let variant = 'paper';

	$: variantClass = variant === 'navy' ? 'content-card--navy' : 'content-card--paper';
</script>

{#if href}
	<a class="content-card content-card-link {variantClass}" href={resolve(href, {})}>
		{#if meta}
			<p class="card-meta">{meta}</p>
		{/if}
		<h3>{title}</h3>
		{#if summary}
			<p class="summary">{summary}</p>
		{/if}
	</a>
{:else}
	<article class="content-card {variantClass}">
		{#if meta}
			<p class="card-meta">{meta}</p>
		{/if}
		<h3>{title}</h3>
		{#if summary}
			<p class="summary">{summary}</p>
		{/if}
	</article>
{/if}

<style>
	.content-card {
		display: grid;
		align-content: start;
		min-width: 0;
		height: 100%;
		padding: clamp(1.1rem, 2.5vw, 1.5rem) var(--space-2xs);
		border-block-end: var(--rule);
		background: var(--card-background);
		color: var(--card-foreground);
		gap: var(--space-xs);
	}

	.content-card--paper {
		--card-background: var(--paper);
		--card-foreground: var(--graphite);
		--card-heading: var(--midnight);
		--card-meta: var(--club-blue);
	}

	.content-card--navy {
		--card-background: var(--midnight);
		--card-foreground: var(--paper);
		--card-heading: var(--paper);
		--card-meta: var(--sky);
	}

	.content-card-link {
		text-decoration: none;
		transition:
			background-color var(--motion-fast) var(--ease-out),
			color var(--motion-fast) var(--ease-out),
			transform var(--motion-press) var(--ease-out);
	}

	.content-card-link:hover {
		background: var(--mist);
		color: var(--club-blue);
	}

	.content-card-link:focus-visible {
		outline: var(--focus-ring-width) solid var(--color-focus);
		outline-offset: var(--focus-ring-offset);
	}

	.content-card-link:active {
		transform: translateY(var(--press-distance));
	}

	.content-card--navy.content-card-link:hover {
		background: rgb(var(--sky-rgb) / 10%);
		color: var(--sky);
	}

	.card-meta {
		color: var(--card-meta);
	}

	h3 {
		max-width: 24ch;
		color: var(--card-heading);
		font-size: var(--text-xl);
		overflow-wrap: break-word;
	}

	.summary {
		max-width: 54ch;
		line-height: 1.55;
		text-wrap: pretty;
	}
</style>
