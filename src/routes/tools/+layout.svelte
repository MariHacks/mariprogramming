<script>
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { isToolNavCurrent, TOOL_NAV_ITEMS } from '$lib/maritools/tools-nav.js';

	$: pathname = $page.url.pathname;
</script>

<div class="tools-shell">
	<aside class="tools-sidebar">
		<a class="tools-brand" href={resolve('/tools', {})}>{MARITOOLS_NAME}</a>
		<nav class="tools-nav" aria-label="MariTools">
			{#each TOOL_NAV_ITEMS as item (item.href)}
				<a
					class:current={isToolNavCurrent(pathname, item.href)}
					href={resolve(item.href, {})}
					aria-current={isToolNavCurrent(pathname, item.href) ? 'page' : undefined}
				>
					{item.label}
				</a>
			{/each}
		</nav>
	</aside>
	<div class="tools-main">
		<slot />
	</div>
</div>

<style>
	.tools-shell {
		display: grid;
		min-height: calc(100vh - 4.5rem - 4.9375rem);
		border-block-end: var(--rule);
		background: var(--paper);
	}

	.tools-sidebar {
		display: grid;
		align-content: start;
		padding: var(--space-lg) var(--page-gutter);
		border-block-end: var(--rule);
		gap: var(--space-sm);
	}

	.tools-brand {
		color: inherit;
		font-family: var(--font-display);
		font-size: var(--text-lg);
		font-weight: 650;
		letter-spacing: -0.03em;
		line-height: 1.1;
		text-decoration: none;
	}

	.tools-nav {
		display: grid;
		border-block: var(--rule);
	}

	.tools-nav a {
		display: flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0.35rem var(--space-2xs);
		border-block-start: var(--rule);
		color: inherit;
		font-size: var(--text-sm);
		font-weight: 600;
		text-decoration: none;
		transition:
			color var(--motion-fast) var(--ease-out),
			background-color var(--motion-fast) var(--ease-out);
	}

	.tools-nav a:first-child {
		border-block-start: 0;
	}

	.tools-nav a:hover {
		background: var(--mist);
		color: var(--club-blue);
	}

	.tools-nav a.current {
		background: rgb(var(--sky-rgb) / 18%);
		color: var(--club-blue);
		box-shadow: inset 0.2rem 0 0 var(--club-blue);
	}

	.tools-main {
		min-width: 0;
	}

	@media (min-width: 52rem) {
		.tools-shell {
			grid-template-columns: minmax(12rem, 16rem) minmax(0, 1fr);
			align-items: stretch;
		}

		.tools-sidebar {
			border-block-end: 0;
			border-inline-end: var(--rule);
		}
	}

	@media (max-width: 43.749rem) {
		.tools-shell {
			min-height: calc(100vh - 4.25rem - 6.5rem);
		}
	}
</style>
