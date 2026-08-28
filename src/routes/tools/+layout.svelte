<script>
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { isToolNavCurrent, TOOL_SECTIONS } from '$lib/maritools/tools-nav.js';
	import '$lib/maritools/styles/preview.css';

	$: pathname = $page.url.pathname;

	let sidebarOpen = false;

	function closeSidebar() {
		sidebarOpen = false;
	}

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}

	/** @param {string} label */
	function sidebarLabel(label) {
		if (label === 'My schedule') return 'Schedule';
		if (label === 'Common free time') return 'Free time';
		if (label === 'Course catalog') return 'Catalog';
		return label;
	}

	/** @param {KeyboardEvent} event */
	function handleKeydown(event) {
		if (event.key === 'Escape') closeSidebar();
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="tools-shell">
	{#if sidebarOpen}
		<button
			class="sidebar-scrim"
			type="button"
			aria-label="Close tools menu"
			on:click={closeSidebar}
		></button>
	{/if}
	<aside class="tools-sidebar" id="tools-sidebar" data-open={sidebarOpen}>
		<div class="tools-brand-row">
			<a class="tools-wordmark" href={resolve('/tools', {})} on:click={closeSidebar}>
				<span class="tools-glyph" aria-hidden="true"><i></i><i></i><i></i></span>
				<b>{MARITOOLS_NAME}</b>
			</a>
			<button class="sidebar-close" type="button" aria-label="Close tools menu" on:click={closeSidebar}>
				Close
			</button>
		</div>
		<p class="tools-context">Student utilities</p>
		<nav class="tools-nav" aria-label="MariTools">
			{#each TOOL_SECTIONS as section (section.id)}
				<section>
					<h2>{section.title}</h2>
					{#each section.items as item (item.href)}
						<a
							class:is-current={isToolNavCurrent(pathname, item.href)}
							href={resolve(item.href, {})}
							aria-current={isToolNavCurrent(pathname, item.href) ? 'page' : undefined}
							on:click={closeSidebar}
						>
							<span>{sidebarLabel(item.label)}</span>
						</a>
					{/each}
				</section>
			{/each}
		</nav>
		<div class="sidebar-note"><span>Winter 2026</span><b>Student tools</b></div>
		<a class="back-club" href={resolve('/', {})} on:click={closeSidebar}>
			Back to club home <span aria-hidden="true">↗</span>
		</a>
	</aside>
	<div class="tools-main">
		<button
			class="tools-menu"
			type="button"
			aria-expanded={sidebarOpen}
			aria-controls="tools-sidebar"
			on:click={toggleSidebar}
		>
			<span aria-hidden="true">☰</span> Tools
		</button>
		<slot />
	</div>
</div>

<style>
	.tools-shell {
		display: grid;
		align-items: stretch;
		min-height: calc(100vh - 4.5rem - 4.9375rem);
		background: var(--paper);
	}

	.tools-sidebar {
		display: grid;
		align-content: start;
		padding: var(--space-md) var(--page-gutter);
		gap: var(--space-sm);
		background: #fff;
		border-block-end: var(--rule);
	}

	.tools-brand-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
	}

	.tools-wordmark {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		color: inherit;
		text-decoration: none;
	}

	.tools-wordmark b {
		font-family: var(--font-display);
		font-size: var(--text-lg);
		font-weight: 650;
		letter-spacing: -0.03em;
	}

	.tools-glyph {
		display: grid;
		gap: 2px;
	}

	.tools-glyph i {
		display: block;
		width: 12px;
		height: 2px;
		background: var(--club-blue);
	}

	.tools-context {
		margin: 0;
		color: var(--quiet-steel);
		font-size: var(--text-xs);
	}

	.tools-nav {
		display: grid;
		gap: var(--space-md);
	}

	.tools-nav section h2 {
		margin: 0 0 var(--space-2xs);
		color: var(--quiet-steel);
		font-size: 0.625rem;
		font-weight: 650;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.tools-nav a {
		position: relative;
		display: flex;
		align-items: center;
		min-height: 2.25rem;
		padding: 0.2rem 0.55rem;
		color: inherit;
		font-size: var(--text-sm);
		font-weight: 600;
		text-decoration: none;
	}

	.tools-nav a:hover {
		color: var(--club-blue);
	}

	.tools-nav a:focus-visible {
		outline: none;
		border-radius: 2px;
		box-shadow: 0 0 0 3px rgb(126 166 255 / 35%);
	}

	.tools-nav a.is-current {
		color: var(--midnight);
		font-weight: 650;
	}

	.tools-nav a.is-current::before {
		position: absolute;
		top: 0.35rem;
		bottom: 0.35rem;
		left: 0;
		width: 1px;
		background: var(--midnight);
		content: '';
	}

	.sidebar-note {
		display: grid;
		gap: 0.15rem;
		padding-block-start: var(--space-sm);
		border-block-start: var(--rule);
		font-size: var(--text-xs);
		color: var(--quiet-steel);
	}

	.sidebar-note b {
		color: var(--midnight);
		font-size: var(--text-sm);
	}

	.back-club {
		color: var(--club-blue);
		font-size: var(--text-sm);
		font-weight: 600;
		text-decoration: none;
	}

	.sidebar-close,
	.tools-menu,
	.sidebar-scrim {
		font: inherit;
		cursor: pointer;
	}

	.sidebar-close {
		display: none;
		border: 0;
		background: transparent;
		color: var(--quiet-steel);
		font-size: var(--text-xs);
		font-weight: 650;
	}

	.tools-menu {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		margin: var(--space-sm) var(--page-gutter) 0;
		padding: 0.45rem 0.7rem;
		border: var(--rule);
		border-radius: var(--radius-xs);
		background: #fff;
		color: inherit;
		font-size: var(--text-sm);
		font-weight: 650;
	}

	.sidebar-scrim {
		display: none;
	}

	.tools-main {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 100%;
		background: var(--surface-raised);
	}

	@media (min-width: 52rem) {
		.tools-shell {
			grid-template-columns: minmax(13rem, 16rem) minmax(0, 1fr);
		}

		.tools-sidebar {
			min-height: 100%;
			border-block-end: 0;
			border-inline-end: var(--rule);
		}

		.tools-menu {
			display: none;
		}
	}

	@media (max-width: 51.999rem) {
		.tools-sidebar {
			position: fixed;
			z-index: 40;
			top: 4.25rem;
			left: 0;
			width: min(18rem, 88vw);
			height: calc(100vh - 4.25rem);
			overflow: auto;
			transform: translateX(-105%);
			transition: transform var(--motion-base) var(--ease-out);
		}

		.tools-sidebar[data-open='true'] {
			transform: none;
		}

		.sidebar-scrim {
			display: block;
			position: fixed;
			z-index: 35;
			inset: 4.25rem 0 0;
			border: 0;
			background: rgb(var(--midnight-rgb) / 28%);
		}

		.sidebar-close {
			display: inline-flex;
		}
	}
</style>
