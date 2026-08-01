<script>
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
	<a class="content-card content-card-link {variantClass}" {href}>
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
		padding: clamp(1.25rem, 2.5vw, 1.75rem);
		border: 1px solid var(--card-border);
		border-block-start: 0.375rem solid var(--card-accent);
		border-radius: var(--radius-sm);
		background: var(--card-background);
		box-shadow: var(--shadow-sm);
		color: var(--card-foreground);
		gap: var(--space-sm);
	}

	.content-card--paper {
		--card-background: var(--paper);
		--card-foreground: var(--graphite);
		--card-heading: var(--midnight);
		--card-meta: var(--club-blue);
		--card-border: rgb(5 13 46 / 18%);
		--card-accent: var(--club-blue);
	}

	.content-card--navy {
		--card-background: var(--midnight);
		--card-foreground: var(--paper);
		--card-heading: var(--paper);
		--card-meta: var(--sky);
		--card-border: rgb(153 194 255 / 36%);
		--card-accent: var(--sky);
	}

	.content-card-link {
		text-decoration: none;
		transition:
			border-color var(--motion-fast) var(--ease-out),
			box-shadow var(--motion-base) var(--ease-out),
			transform var(--motion-fast) var(--ease-out);
	}

	.content-card-link:hover {
		border-color: var(--card-accent);
		box-shadow: var(--shadow-md);
		transform: translateY(-0.1875rem);
	}

	.content-card-link:focus-visible {
		outline: 3px solid var(--color-focus);
		outline-offset: 4px;
		border-color: var(--card-accent);
		box-shadow: var(--shadow-md);
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
