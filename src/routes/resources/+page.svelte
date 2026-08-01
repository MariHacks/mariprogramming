<script>
	import SectionIntro from '$lib/components/site/SectionIntro.svelte';
	import { clubContent } from '$lib/content/club';

	const metaDescription =
		'Choose a practical programming learning path and open current resources collected by the Marianopolis Programming Club.';
</script>

<svelte:head>
	<title>Resources | {clubContent.name}</title>
	<meta name="description" content={metaDescription} />
</svelte:head>

<section class="resources-hero surface-paper">
	<div class="page-container hero-grid">
		<SectionIntro
			eyebrow="Learning routes"
			title="Choose a learning path for your next step"
			summary="Start with the goal that matches what you want to learn. Each path gives you options for beginning a subject or going deeper into one you already know."
		/>

		<aside class="chooser-note" aria-labelledby="chooser-note-title">
			<p class="utility-label">How to choose</p>
			<h2 id="chooser-note-title">Start with the goal, not the tool</h2>
			<p>
				Each path groups resources around one direction. Pick a path first, then open the resource
				that best matches how you want to learn.
			</p>
		</aside>
	</div>
</section>

<section class="path-directory surface-navy" aria-label="Resource path directory">
	<div class="page-container">
		<header class="directory-heading">
			<p class="eyebrow">Path directory</p>
			<p>Compare the goals, then choose one resource to begin.</p>
		</header>

		<ul class="path-list" aria-label="Programming learning paths">
			{#each clubContent.resources as path (path.id)}
				<li class="path-entry">
					<article aria-labelledby={`path-${path.id}-title`}>
						<div class="path-index" aria-hidden="true">
							<p>Path / {path.id.replaceAll('-', ' ')}</p>
							<span></span>
						</div>

						<div class="path-copy">
							<h2 id={`path-${path.id}-title`}>{path.title}</h2>
							<p>{path.description}</p>
						</div>

						<div class="resource-set">
							<p class="resource-label">
								{path.links.length}
								{path.links.length === 1 ? 'resource' : 'resources'}
							</p>
							<ul aria-label={`Resources for ${path.title}`}>
								{#each path.links as resource (resource.url)}
									<li>
										<a
											class="resource-link"
											href={resource.url}
											target="_blank"
											rel="noopener noreferrer"
											aria-label={`Open ${resource.label} for ${path.title}`}
										>
											<span>{resource.label}</span>
											<span aria-hidden="true">↗</span>
										</a>
									</li>
								{/each}
							</ul>
						</div>
					</article>
				</li>
			{/each}
		</ul>
	</div>
</section>

<section class="next-step surface-paper" aria-labelledby="next-step-title">
	<div class="page-container">
		<div class="next-step-panel">
			<header>
				<p class="eyebrow">Continue with the club</p>
				<h2 id="next-step-title">Pair a resource with club material</h2>
			</header>

			<div class="next-step-copy">
				<p>
					Use the workshop archive when you want the club’s original slides and exercises. Follow
					the club for current announcements.
				</p>
				<div class="action-row">
					<a class="button-secondary" href="/our-workshops">Browse club workshops</a>
					<a
						class="button-primary"
						href={clubContent.communityAction.url}
						target="_blank"
						rel="noopener noreferrer"
					>
						{clubContent.communityAction.label}
					</a>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	.resources-hero {
		padding-block: clamp(4.5rem, 10vw, 8rem);
	}

	.hero-grid {
		display: grid;
		align-items: end;
		gap: clamp(3rem, 8vw, 8rem);
	}

	.hero-grid :global(.section-intro) {
		max-width: 54rem;
	}

	.chooser-note {
		display: grid;
		align-content: start;
		min-width: 0;
		padding-block-start: var(--space-md);
		border-block-start: 1px solid var(--color-border-strong);
		gap: var(--space-sm);
	}

	.chooser-note h2 {
		max-width: 16ch;
		font-size: var(--text-2xl);
	}

	.chooser-note > p:last-child {
		max-width: 34rem;
		line-height: 1.6;
		text-wrap: pretty;
	}

	.path-directory {
		padding-block: var(--section-space);
	}

	.directory-heading {
		display: grid;
		align-items: end;
		min-width: 0;
		padding-block-end: var(--space-lg);
		gap: var(--space-md);
	}

	.directory-heading > p:last-child {
		max-width: 34rem;
		color: rgb(247 244 237 / 72%);
		line-height: 1.6;
		text-wrap: pretty;
	}

	.path-list,
	.resource-set ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.path-list {
		border-block-end: 1px solid rgb(153 194 255 / 28%);
	}

	.path-entry {
		min-width: 0;
		border-block-start: 1px solid rgb(153 194 255 / 28%);
	}

	.path-entry article {
		display: grid;
		min-width: 0;
		padding-block: clamp(2rem, 6vw, 4.5rem);
		gap: var(--space-lg);
	}

	.path-index {
		display: grid;
		grid-template-columns: max-content minmax(2rem, 1fr);
		align-items: center;
		min-width: 0;
		gap: var(--space-xs);
	}

	.path-index p,
	.resource-label {
		color: var(--sky);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		letter-spacing: 0.09em;
		line-height: 1.45;
		text-transform: uppercase;
	}

	.path-index span {
		width: 100%;
		height: 1px;
		background: var(--sky);
		opacity: 0.62;
	}

	.path-copy {
		display: grid;
		align-content: start;
		min-width: 0;
		gap: var(--space-sm);
	}

	.path-copy h2 {
		max-width: 18ch;
	}

	.path-copy > p {
		max-width: 38rem;
		color: rgb(247 244 237 / 78%);
		line-height: 1.6;
		text-wrap: pretty;
	}

	.resource-set {
		display: grid;
		align-content: start;
		min-width: 0;
		gap: var(--space-xs);
	}

	.resource-set ul {
		border-block-start: 1px solid rgb(153 194 255 / 38%);
	}

	.resource-set li {
		min-width: 0;
		border-block-end: 1px solid rgb(153 194 255 / 24%);
	}

	.resource-link {
		display: grid;
		grid-template-columns: minmax(0, 1fr) max-content;
		align-items: center;
		min-width: 0;
		min-height: 3.5rem;
		padding: 0.75rem var(--space-xs);
		color: var(--paper);
		font-size: var(--text-sm);
		font-weight: 600;
		line-height: 1.35;
		text-decoration: none;
		column-gap: var(--space-sm);
		transition:
			background-color var(--motion-fast) var(--ease-out),
			color var(--motion-fast) var(--ease-out);
	}

	.resource-link > span:first-child {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.resource-link > span:last-child {
		color: var(--sky);
		font-family: var(--font-mono);
		font-size: var(--text-lg);
		line-height: 1;
	}

	.resource-link:hover {
		background: rgb(153 194 255 / 14%);
		color: var(--sky);
	}

	.next-step {
		padding-block: var(--section-space);
	}

	.next-step-panel {
		display: grid;
		min-width: 0;
		padding-block: clamp(2rem, 5vw, 3.5rem);
		border-block: 1px solid var(--color-border-strong);
		gap: clamp(2rem, 7vw, 6rem);
	}

	.next-step-panel > header,
	.next-step-copy {
		display: grid;
		align-content: start;
		min-width: 0;
		gap: var(--space-md);
	}

	.next-step-panel h2 {
		max-width: 17ch;
	}

	.next-step-copy > p {
		max-width: 38rem;
		font-size: var(--text-lg);
		line-height: 1.6;
		text-wrap: pretty;
	}

	.action-row {
		display: flex;
		align-items: stretch;
		flex-wrap: wrap;
		gap: var(--space-xs);
	}

	@media (min-width: 46rem) {
		.directory-heading {
			grid-template-columns: minmax(0, 1fr) minmax(19rem, 0.8fr);
		}
	}

	@media (min-width: 52rem) {
		.hero-grid {
			grid-template-columns: minmax(0, 1.5fr) minmax(18rem, 0.65fr);
		}

		.path-entry article {
			grid-template-columns: minmax(5.5rem, 0.32fr) minmax(0, 1.02fr) minmax(16rem, 0.9fr);
			column-gap: clamp(2rem, 6vw, 5rem);
		}

		.path-index {
			grid-template-columns: 1fr;
			align-content: start;
		}

		.path-index span {
			max-width: 4rem;
		}

		.next-step-panel {
			grid-template-columns: minmax(0, 0.8fr) minmax(19rem, 1.2fr);
		}
	}

	@media (max-width: 24rem) {
		.action-row :is(.button-primary, .button-secondary) {
			width: 100%;
		}
	}
</style>
