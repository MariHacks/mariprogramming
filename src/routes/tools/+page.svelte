<script>
	import { resolve } from '$app/paths';
	import { MARITOOLS_LINE, MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { TOOL_SECTIONS } from '$lib/maritools/tools-nav.js';
</script>

<svelte:head>
	<title>{MARITOOLS_NAME}</title>
	<meta name="description" content={MARITOOLS_LINE} />
</svelte:head>

<section class="tools-home page-container">
	<header class="intro">
		<h1>{MARITOOLS_NAME}</h1>
		<p>{MARITOOLS_LINE}</p>
	</header>

	{#each TOOL_SECTIONS as section (section.id)}
		<section class="suite-section" aria-labelledby="{section.id}-title">
			<h2 id="{section.id}-title">{section.title}</h2>
			<ul>
				{#each section.items as item (item.href)}
					<li>
						<a href={resolve(item.href, {})}>
							<span class="label">{item.label}</span>
							<span class="summary">{item.summary}</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</section>

<style>
	.tools-home {
		display: grid;
		padding-block: var(--space-xl);
		gap: var(--space-xl);
	}

	.intro h1 {
		font-family: var(--font-display);
		font-size: var(--text-3xl);
		line-height: 1.05;
		max-width: 12ch;
	}

	.intro p {
		max-width: 42ch;
		margin-top: var(--space-sm);
		font-size: var(--text-lg);
	}

	.suite-section {
		display: grid;
		gap: var(--space-sm);
		border-block-start: var(--rule);
		padding-block-start: var(--space-md);
	}

	.suite-section h2 {
		font-size: var(--text-sm);
		font-weight: 700;
	}

	.suite-section ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.suite-section li + li {
		border-block-start: var(--rule);
	}

	.suite-section a {
		display: grid;
		gap: var(--space-3xs);
		padding-block: var(--space-sm);
		color: inherit;
		text-decoration: none;
	}

	.suite-section a:hover .label,
	.suite-section a:focus-visible .label {
		color: var(--club-blue);
	}

	.label {
		font-weight: 650;
	}

	.summary {
		color: var(--quiet-steel);
		font-size: var(--text-sm);
	}
</style>
