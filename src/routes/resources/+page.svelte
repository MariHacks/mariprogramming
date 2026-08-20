<script>
	import SectionIntro from '$lib/components/site/SectionIntro.svelte';
	import { clubContent } from '$lib/content/club';

	const metaDescription = 'Programming resources from Marianopolis Programming Club.';
</script>

<svelte:head>
	<title>Resources | {clubContent.name}</title>
	<meta name="description" content={metaDescription} />
</svelte:head>

<section class="resources-page surface-paper">
	<div class="page-container resources-frame">
		<SectionIntro title="Resources" />

		<ul class="path-list" aria-label="Programming learning paths">
			{#each clubContent.resources as path (path.id)}
				<li class="path-entry">
					<article aria-labelledby={`path-${path.id}-title`}>
						<div class="path-copy">
							<h2 id={`path-${path.id}-title`}>{path.title}</h2>
							<p>{path.description}</p>
						</div>

						<ul class="resource-list" aria-label={`Resources for ${path.title}`}>
							{#each path.links as resource (resource.url)}
								<li>
									<a
										class="resource-link"
										href={resource.url}
										target="_blank"
										rel="external noopener noreferrer"
										aria-label={`Open ${resource.label} for ${path.title}`}
									>
										<span>{resource.label}</span>
										<span aria-hidden="true">↗</span>
									</a>
								</li>
							{/each}
						</ul>
					</article>
				</li>
			{/each}
		</ul>
	</div>
</section>

<style>
	.resources-page {
		border-block-end: var(--rule);
	}

	.resources-frame {
		display: grid;
		padding-block: clamp(3.5rem, 7vw, 6rem);
		gap: clamp(2.75rem, 7vw, 5.5rem);
	}

	.resources-frame :global(.section-intro) {
		max-width: 40rem;
	}

	.path-list,
	.resource-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.path-list {
		border-block: var(--rule-strong);
	}

	.path-entry {
		max-width: none;
		min-width: 0;
	}

	.path-entry + .path-entry {
		border-block-start: var(--rule-strong);
	}

	.path-entry article {
		display: grid;
		min-width: 0;
		padding-block: var(--space-lg);
		gap: var(--space-lg);
	}

	.path-copy {
		display: grid;
		align-content: start;
		min-width: 0;
		gap: var(--space-xs);
	}

	.path-copy h2 {
		max-width: 20ch;
		font-size: var(--text-xl);
		letter-spacing: -0.025em;
		line-height: 1.2;
	}

	.path-copy p {
		max-width: 36rem;
		color: var(--quiet-steel);
		font-size: var(--text-sm);
		line-height: 1.55;
		text-wrap: pretty;
	}

	.resource-list {
		min-width: 0;
		border-block-start: var(--rule);
	}

	.resource-list li {
		max-width: none;
		min-width: 0;
		border-block-end: var(--rule);
	}

	.resource-link {
		display: grid;
		grid-template-columns: minmax(0, 1fr) max-content;
		align-items: center;
		min-height: 3.25rem;
		padding: 0.65rem var(--space-2xs);
		color: var(--graphite);
		font-size: var(--text-sm);
		font-weight: 600;
		line-height: 1.35;
		text-decoration: none;
		column-gap: var(--space-sm);
		transition:
			background-color var(--motion-fast) var(--ease-out),
			color var(--motion-fast) var(--ease-out),
			transform var(--motion-press) var(--ease-out);
	}

	.resource-link > span:first-child {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.resource-link > span:last-child {
		color: var(--club-blue);
	}

	.resource-link:hover {
		background: var(--mist);
		color: var(--club-blue);
	}

	.resource-link:active {
		transform: translateY(var(--press-distance));
	}

	@media (min-width: 52rem) {
		.path-entry article {
			grid-template-columns: minmax(14rem, 0.64fr) minmax(0, 1.36fr);
			column-gap: clamp(2rem, 5vw, 4.5rem);
		}

		.resource-list {
			padding-inline-start: clamp(2rem, 4vw, 3.5rem);
			border-block-start: 0;
			border-inline-start: var(--rule);
		}
	}
</style>
