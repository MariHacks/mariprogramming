<script>
	import SectionIntro from '$lib/components/site/SectionIntro.svelte';
	import { clubContent, getWorkshopTracks } from '$lib/content/club';

	const workshopTracks =
		/** @type {Array<[string, Array<(typeof clubContent.workshops)[number]>]>} */ (
			Object.entries(getWorkshopTracks(clubContent.workshops))
		);
	const archiveDescription =
		'Browse the Marianopolis Programming Club workshop archive by learning track and open the original lesson materials.';
</script>

<svelte:head>
	<title>Workshops | {clubContent.name}</title>
	<meta name="description" content={archiveDescription} />
</svelte:head>

<section class="archive-hero surface-paper">
	<div class="page-container hero-grid">
		<SectionIntro
			eyebrow="Workshop archive"
			title="Learn from the workshop archive"
			summary="Choose a learning track, then use the club's original slides and exercises as a self-paced archive."
		/>

		<aside class="archive-note" aria-label="Archive context">
			<p class="utility-label">Source collection</p>
			<p class="source-term">2023–2024 source term</p>
			<p>
				These are past workshop materials, not a current event schedule. Start at the top of a track
				or open the topic you need.
			</p>
		</aside>
	</div>
</section>

<section class="archive surface-navy" aria-label="Workshop learning tracks">
	<div class="page-container track-list">
		{#each workshopTracks as [trackName, workshops], trackIndex (trackName)}
			<section class="track" aria-labelledby={`track-${trackIndex + 1}-title`}>
				<header class="track-header">
					<div>
						<p class="card-meta">Learning track {String(trackIndex + 1).padStart(2, '0')}</p>
						<h2 id={`track-${trackIndex + 1}-title`}>{trackName}</h2>
					</div>
					<p class="track-count">
						{workshops.length}
						{workshops.length === 1 ? 'workshop' : 'workshops'}
					</p>
				</header>

				<ol class="workshop-list">
					{#each workshops as workshop, workshopIndex (workshop.id)}
						<li class="workshop-entry">
							<p class="lesson-number" aria-hidden="true">
								{String(workshopIndex + 1).padStart(2, '0')}
							</p>

							<article class="workshop-body">
								<div class="workshop-copy">
									<p class="card-meta">Source term {workshop.term}</p>
									<h3>{workshop.title}</h3>
									<p>{workshop.description}</p>
								</div>

								<div class="materials">
									<p class="materials-label">Workshop materials</p>
									<ul aria-label={`${workshop.title} materials`}>
										{#each workshop.links as material (material.url)}
											<li>
												<a
													class="material-link"
													href={material.url}
													target="_blank"
													rel="noopener noreferrer"
													aria-label={`Open ${workshop.title} ${material.label}`}
												>
													<span>{material.label}</span>
													<span aria-hidden="true">↗</span>
												</a>
											</li>
										{/each}
									</ul>
								</div>
							</article>
						</li>
					{/each}
				</ol>
			</section>
		{/each}
	</div>
</section>

<section class="updates surface-paper" aria-label="Workshop updates">
	<div class="page-container">
		<div class="updates-panel">
			<div>
				<p class="eyebrow">Current updates</p>
				<p class="updates-title">Follow the next workshop announcement.</p>
			</div>
			<div class="updates-copy">
				<p>New dates appear only after the club confirms them.</p>
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
</section>

<style>
	.archive-hero {
		padding-block: clamp(4.5rem, 10vw, 8rem);
	}

	.hero-grid {
		display: grid;
		align-items: end;
		gap: clamp(3rem, 8vw, 8rem);
	}

	.hero-grid :global(.section-intro) {
		max-width: 52rem;
	}

	.archive-note {
		display: grid;
		min-width: 0;
		padding-block-start: var(--space-md);
		border-block-start: 1px solid var(--color-border-strong);
		gap: var(--space-sm);
	}

	.source-term {
		color: var(--midnight);
		font-family: var(--font-display);
		font-size: var(--text-xl);
		font-weight: 600;
		letter-spacing: -0.025em;
		line-height: 1.2;
	}

	.archive-note > p:last-child {
		line-height: 1.6;
		text-wrap: pretty;
	}

	.archive {
		padding-block: var(--section-space);
	}

	.track-list {
		display: grid;
		gap: var(--space-2xl);
	}

	.track {
		min-width: 0;
		padding-block-start: var(--space-lg);
		border-block-start: 1px solid rgb(153 194 255 / 58%);
	}

	.track-header {
		display: grid;
		align-items: end;
		min-width: 0;
		margin-block-end: var(--space-lg);
		gap: var(--space-md);
	}

	.track-header > div {
		display: grid;
		min-width: 0;
		gap: var(--space-sm);
	}

	.track-header h2 {
		max-width: 20ch;
	}

	.track-count {
		width: fit-content;
		color: rgb(247 244 237 / 72%);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.workshop-list,
	.materials ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.workshop-list {
		border-block-end: 1px solid rgb(153 194 255 / 24%);
	}

	.workshop-entry {
		display: grid;
		grid-template-columns: 2.5rem minmax(0, 1fr);
		min-width: 0;
		padding-block: clamp(1.5rem, 4vw, 2.5rem);
		border-block-start: 1px solid rgb(153 194 255 / 24%);
		column-gap: var(--space-sm);
	}

	.lesson-number {
		color: var(--sky);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		line-height: 1.45;
	}

	.workshop-body {
		display: grid;
		min-width: 0;
		gap: var(--space-lg);
	}

	.workshop-copy {
		display: grid;
		min-width: 0;
		gap: var(--space-sm);
	}

	.workshop-copy h3 {
		max-width: 25ch;
		font-size: var(--text-xl);
	}

	.workshop-copy > p:last-child {
		max-width: 52ch;
		color: rgb(247 244 237 / 78%);
		line-height: 1.6;
		text-wrap: pretty;
	}

	.materials {
		display: grid;
		align-content: start;
		min-width: 0;
		gap: var(--space-xs);
	}

	.materials-label {
		color: rgb(247 244 237 / 62%);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.materials ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
	}

	.material-link {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0.55rem 0.8rem;
		border: 1px solid rgb(153 194 255 / 48%);
		border-radius: var(--radius-xs);
		color: var(--paper);
		font-size: var(--text-sm);
		font-weight: 600;
		line-height: 1.2;
		text-decoration: none;
		column-gap: var(--space-2xs);
		transition:
			border-color var(--motion-fast) var(--ease-out),
			background-color var(--motion-fast) var(--ease-out),
			color var(--motion-fast) var(--ease-out);
	}

	.material-link:hover {
		border-color: var(--sky);
		background: var(--sky);
		color: var(--midnight);
	}

	.updates {
		padding-block: var(--section-space);
	}

	.updates-panel {
		display: grid;
		min-width: 0;
		padding-block: clamp(2rem, 5vw, 3.5rem);
		border-block: 1px solid var(--color-border-strong);
		gap: clamp(2rem, 7vw, 6rem);
	}

	.updates-panel > div {
		display: grid;
		align-content: start;
		justify-items: start;
		min-width: 0;
		gap: var(--space-md);
	}

	.updates-title {
		max-width: 18ch;
		color: var(--midnight);
		font-family: var(--font-display);
		font-size: var(--text-2xl);
		font-weight: 600;
		letter-spacing: -0.035em;
		line-height: 1.1;
		text-wrap: balance;
	}

	.updates-copy > p {
		line-height: 1.6;
		text-wrap: pretty;
	}

	@media (min-width: 42rem) {
		.track-header {
			grid-template-columns: minmax(0, 1fr) max-content;
		}

		.workshop-entry {
			grid-template-columns: 3.5rem minmax(0, 1fr);
			column-gap: var(--space-md);
		}
	}

	@media (min-width: 52rem) {
		.hero-grid {
			grid-template-columns: minmax(0, 1.5fr) minmax(17rem, 0.65fr);
		}

		.workshop-body {
			grid-template-columns: minmax(0, 1.5fr) minmax(12rem, 0.5fr);
			column-gap: clamp(2rem, 6vw, 5rem);
		}

		.updates-panel {
			grid-template-columns: minmax(0, 0.9fr) minmax(19rem, 1.1fr);
		}
	}

	@media (max-width: 24rem) {
		.workshop-entry {
			grid-template-columns: 1fr;
			row-gap: var(--space-xs);
		}

		.updates-copy .button-primary {
			width: 100%;
		}
	}
</style>
