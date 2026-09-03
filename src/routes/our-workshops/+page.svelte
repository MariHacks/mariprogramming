<script>
	import SectionIntro from '$lib/components/site/SectionIntro.svelte';
	import { clubContent, getWorkshopTracks } from '$lib/content/club';

	const workshopTracks =
		/** @type {Array<[string, Array<(typeof clubContent.workshops)[number]>]>} */ (
			Object.entries(getWorkshopTracks(clubContent.workshops))
		);
	const archiveDescription = 'Original Marianopolis Programming Club workshop materials.';
</script>

<svelte:head>
	<title>Workshops | {clubContent.name}</title>
	<meta name="description" content={archiveDescription} />
</svelte:head>

<section class="archive-page surface-paper editorial-page">
	<div class="page-container archive-frame editorial-frame">
		<SectionIntro
			title="Workshop archive"
			summary="Original workshop materials made by the club."
		/>

		<div class="track-list" aria-label="Workshop learning tracks">
			{#each workshopTracks as [trackName, workshops], trackIndex (trackName)}
				<section class="track" aria-labelledby={`track-${trackIndex + 1}-title`}>
					<header class="track-header">
						<h2 id={`track-${trackIndex + 1}-title`}>{trackName}</h2>
					</header>

					<ul class="workshop-list">
						{#each workshops as workshop (workshop.id)}
							<li class="workshop-entry">
								<article class="workshop-row">
									<div class="workshop-copy">
										<h3>{workshop.title}</h3>
										<p>{workshop.description}</p>
									</div>

									<ul class="material-list" aria-label={`${workshop.title} materials`}>
										{#each workshop.links as material (material.url)}
											<li>
												<a
													class="material-link"
													href={material.url}
													target="_blank"
													rel="external noopener noreferrer"
													aria-label={`Open ${workshop.title} ${material.label}`}
												>
													<span>{material.label}</span>
													<span aria-hidden="true">↗</span>
												</a>
											</li>
										{/each}
									</ul>
								</article>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	</div>
</section>

<style>
	.archive-frame {
		gap: clamp(2.75rem, 7vw, 5.5rem);
	}

	.archive-frame :global(.section-intro) {
		max-width: 42rem;
	}

	.track-list {
		border-block: var(--rule-strong);
	}

	.track {
		display: grid;
		min-width: 0;
		padding-block: var(--space-lg);
		gap: var(--space-lg);
	}

	.track + .track {
		border-block-start: var(--rule-strong);
	}

	.track-header {
		align-content: start;
		min-width: 0;
	}

	.track-header h2 {
		max-width: 18ch;
		font-size: var(--text-xl);
		letter-spacing: -0.025em;
		line-height: 1.2;
	}

	.workshop-list,
	.material-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.workshop-list,
	.workshop-entry {
		min-width: 0;
	}

	.workshop-entry {
		max-width: none;
	}

	.workshop-entry + .workshop-entry {
		border-block-start: var(--rule);
	}

	.workshop-row {
		display: grid;
		min-width: 0;
		padding-block: var(--space-md);
		gap: var(--space-md);
	}

	.workshop-entry:first-child .workshop-row {
		padding-block-start: 0;
	}

	.workshop-entry:last-child .workshop-row {
		padding-block-end: 0;
	}

	.workshop-copy {
		display: grid;
		align-content: start;
		min-width: 0;
		gap: var(--space-xs);
	}

	.workshop-copy h3 {
		max-width: 28ch;
		font-size: var(--text-xl);
		letter-spacing: -0.025em;
		line-height: 1.2;
		overflow-wrap: anywhere;
	}

	.workshop-copy p {
		max-width: 48rem;
		color: var(--quiet-steel);
		font-size: var(--text-sm);
		line-height: 1.55;
		text-wrap: pretty;
	}

	.material-list {
		display: flex;
		align-content: start;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: var(--space-xs) var(--space-md);
	}

	.material-list li {
		max-width: none;
	}

	.material-link {
		display: inline-grid;
		grid-template-columns: minmax(0, auto) max-content;
		align-items: center;
		min-height: var(--control-height);
		padding-block: 0.4rem;
		border-block-end: 1px solid currentColor;
		color: var(--club-blue);
		font-size: var(--text-sm);
		font-weight: 600;
		line-height: 1.25;
		text-decoration: none;
		column-gap: var(--space-2xs);
		transition:
			border-color var(--motion-fast) var(--ease-out),
			color var(--motion-fast) var(--ease-out),
			transform var(--motion-press) var(--ease-out);
	}

	.material-link:hover {
		border-color: var(--midnight);
		color: var(--midnight);
	}

	.material-link:active {
		transform: translateY(var(--press-distance));
	}

	@media (min-width: 52rem) {
		.track {
			grid-template-columns: minmax(12rem, 0.46fr) minmax(0, 1.54fr);
			column-gap: clamp(2rem, 5vw, 4.5rem);
		}

		.workshop-list {
			padding-inline-start: clamp(2rem, 4vw, 3.5rem);
			border-inline-start: var(--rule);
		}

		.workshop-row {
			grid-template-columns: minmax(0, 1.35fr) minmax(10rem, 0.65fr);
			column-gap: clamp(1.5rem, 4vw, 3.5rem);
		}
	}
</style>
