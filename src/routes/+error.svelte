<script>
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import SectionIntro from '$lib/components/site/SectionIntro.svelte';
	import { clubContent } from '$lib/content/club';
	import { createClubContactLinks } from '$lib/club-contact.js';

	const recoveryRoutes = [
		{ label: 'Browse workshops', href: '/pbl' },
		{ label: 'Check events', href: '/events' },
		{ label: 'Open resources', href: '/resources' }
	];
	const contactLinks = createClubContactLinks();

	$: isNotFound = $page.status === 404;
	$: heading = isNotFound ? 'We couldn’t find that page.' : 'This page is unavailable.';
	$: summary = isNotFound ? 'The address may have changed.' : 'We couldn’t load this page.';
	$: pageTitle = isNotFound ? 'Page not found' : 'Page unavailable';
</script>

<svelte:head>
	<title>{pageTitle} | {clubContent.name}</title>
	<meta name="description" content="Marianopolis Programming Club page unavailable." />
</svelte:head>

<section class="error-page surface-paper">
	<div class="page-container recovery-layout editorial-frame">
		<div class="recovery-copy">
			<SectionIntro title={heading} {summary} />

			<div class="status-reference">
				<p class="status-code">Status {$page.status}</p>
				{#if $page.error?.message}
					<p class="status-message">{$page.error.message}</p>
				{/if}
			</div>

			<a class="button-primary home-action" href={resolve('/', {})}>Return to club home</a>
		</div>

		<aside class="recovery-index surface-ink-panel" aria-labelledby="recovery-index-title">
			<div class="index-heading">
				<h2 id="recovery-index-title">Try another path</h2>
			</div>

			<nav aria-label="Recovery routes">
				<ul class="route-list ruled-index">
					{#each recoveryRoutes as route (route.href)}
						<li>
							<a class="ruled-link" aria-label={route.label} href={resolve(route.href, {})}>
								<span>{route.label}</span>
								<code aria-hidden="true">{route.href}</code>
							</a>
						</li>
					{/each}
				</ul>
			</nav>

			<div class="community-path">
				<nav class="error-contact" aria-label="Club contact">
					<a href={contactLinks.inquiry.href} rel="external">{contactLinks.inquiry.label}</a>
					<a href={contactLinks.bug.href} rel="external">{contactLinks.bug.label}</a>
				</nav>
				<a
					href={clubContent.communityAction.url}
					target="_blank"
					rel="external noopener noreferrer"
				>
					{clubContent.communityAction.label}
				</a>
			</div>
		</aside>
	</div>
</section>

<style>
	.error-page {
		padding-block: clamp(4.5rem, 10vw, 8rem);
	}

	.recovery-layout {
		align-items: start;
	}

	.recovery-copy {
		display: grid;
		min-width: 0;
		justify-items: start;
		gap: var(--space-lg);
	}

	.recovery-copy :global(.section-intro) {
		max-width: 46rem;
	}

	.status-reference {
		display: flex;
		align-items: baseline;
		min-width: 0;
		max-width: 100%;
		padding-block: var(--space-xs);
		border-block: 1px solid var(--color-border);
		font-family: var(--font-body);
		font-size: var(--text-xs);
		line-height: 1.5;
	}

	.status-code {
		flex: none;
		padding-inline-end: var(--space-sm);
		color: var(--club-blue);
		font-family: var(--font-mono);
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.status-message {
		min-width: 0;
		padding-inline-start: var(--space-sm);
		border-inline-start: 1px solid var(--color-border-strong);
		color: rgb(var(--graphite-rgb) / 72%);
		overflow-wrap: anywhere;
	}

	.home-action {
		margin-block-start: var(--space-xs);
	}

	.recovery-index {
		display: grid;
		min-width: 0;
		padding: clamp(1.5rem, 4vw, 2.5rem);
		border-block: var(--rule);
		gap: var(--space-lg);
	}

	.index-heading {
		display: grid;
		gap: var(--space-sm);
	}

	.index-heading h2 {
		color: var(--paper);
		font-size: var(--text-2xl);
	}

	.route-list .ruled-link {
		grid-template-columns: minmax(0, 1fr);
		min-height: auto;
		padding-block: var(--space-sm);
		border-block-end: 0;
		color: var(--paper);
		font-weight: 600;
		gap: var(--space-3xs);
	}

	.route-list .ruled-link:hover {
		background: rgb(var(--paper-rgb) / 8%);
		color: var(--sky);
	}

	.route-list code {
		width: fit-content;
		max-width: 100%;
		padding: 0;
		background: transparent;
		color: rgb(var(--sky-rgb) / 76%);
		font-size: var(--text-xs);
		overflow-wrap: anywhere;
	}

	.community-path {
		display: grid;
		gap: var(--space-sm);
	}

	.error-contact {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1.25rem;
	}

	.error-contact a {
		width: fit-content;
		max-width: 100%;
		color: var(--sky);
		font-weight: 600;
		text-decoration-color: rgb(var(--sky-rgb) / 55%);
		text-decoration-thickness: 0.1em;
		text-underline-offset: 0.2em;
	}

	.community-path a {
		width: fit-content;
		max-width: 100%;
		color: var(--sky);
		font-weight: 600;
		text-decoration-color: rgb(var(--sky-rgb) / 55%);
		text-decoration-thickness: 0.1em;
		text-underline-offset: 0.2em;
		overflow-wrap: anywhere;
	}

	.community-path a:hover {
		text-decoration-color: currentColor;
	}

	@media (min-width: 52rem) {
		.recovery-layout {
			grid-template-columns: minmax(0, 1.35fr) minmax(19rem, 0.65fr);
		}
	}

	@media (max-width: 24rem) {
		.status-reference {
			align-items: stretch;
			flex-direction: column;
		}

		.status-code {
			padding-block-end: var(--space-2xs);
			padding-inline-end: 0;
		}

		.status-message {
			padding-block-start: var(--space-2xs);
			padding-inline-start: 0;
			border-block-start: 1px solid var(--color-border-strong);
			border-inline-start: 0;
		}

		.home-action {
			width: 100%;
		}
	}
</style>
