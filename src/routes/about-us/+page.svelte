<script>
	import ContentCard from '$lib/components/site/ContentCard.svelte';
	import SectionIntro from '$lib/components/site/SectionIntro.svelte';
	import { clubContent } from '$lib/content/club';

	const firstWorkshop = clubContent.workshops[0];
	const firstResource = clubContent.resources[0];
</script>

<svelte:head>
	<title>About | {clubContent.name}</title>
	<meta name="description" content={clubContent.mission} />
</svelte:head>

<section class="about-hero surface-paper">
	<div class="page-container hero-grid">
		<SectionIntro
			eyebrow="About the club"
			title="You can start before you know how to code."
			summary={clubContent.mission}
		/>

		<aside class="entry-note" aria-labelledby="entry-note-title">
			<p class="utility-label">Before you begin</p>
			<h2 id="entry-note-title">No experience required</h2>
			<p>
				You do not need a portfolio, a finished project, or the right vocabulary. Pick one topic
				that interests you and use the material at your own pace.
			</p>
		</aside>
	</div>
</section>

<section class="learning-section surface-navy" aria-labelledby="learning-title">
	<div class="page-container learning-grid">
		<header class="learning-copy">
			<p class="eyebrow">How we learn together</p>
			<h2 id="learning-title">Use the path that matches your starting point</h2>
			<p>
				Club workshop material breaks programming into focused topics. Resource guides offer a
				self-paced route when you would rather explore first.
			</p>
		</header>

		<div class="starting-points" aria-label="Learning starting points">
			<ContentCard
				title={firstWorkshop.title}
				summary={firstWorkshop.description}
				meta="Workshop starting point"
				variant="paper"
			/>
			<ContentCard
				title={firstResource.title}
				summary={firstResource.description}
				meta="Self-paced starting point"
				variant="paper"
			/>
		</div>
	</div>
</section>

<section class="next-step surface-paper" aria-labelledby="next-step-title">
	<div class="page-container">
		<div class="next-step-panel">
			<header>
				<p class="eyebrow">Your next move</p>
				<h2 id="next-step-title">Start where you feel comfortable</h2>
			</header>

			<div class="next-step-copy">
				<p>
					Follow the club for updates and conversation. If you prefer to look around first, begin
					with a short workshop from the archive.
				</p>
				<div class="action-row">
					<a
						class="button-primary"
						href={clubContent.communityAction.url}
						target="_blank"
						rel="noopener noreferrer"
					>
						{clubContent.communityAction.label}
					</a>
					<a class="button-secondary" href="/our-workshops">Browse beginner workshops</a>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	.about-hero {
		padding-block: clamp(4.5rem, 10vw, 8rem);
	}

	.hero-grid {
		display: grid;
		align-items: end;
		gap: clamp(3rem, 8vw, 8rem);
	}

	.hero-grid :global(.section-intro) {
		max-width: 50rem;
	}

	.entry-note {
		display: grid;
		align-content: start;
		min-width: 0;
		padding: var(--space-lg) 0 0;
		border-block-start: 1px solid var(--color-border-strong);
		gap: var(--space-md);
	}

	.entry-note h2 {
		max-width: 14ch;
		font-size: var(--text-2xl);
	}

	.entry-note > p:not(.utility-label) {
		line-height: 1.6;
		text-wrap: pretty;
	}

	.learning-section {
		padding-block: var(--section-space);
	}

	.learning-grid {
		display: grid;
		align-items: start;
		gap: clamp(2.5rem, 7vw, 6rem);
	}

	.learning-copy {
		display: grid;
		align-content: start;
		gap: var(--space-md);
	}

	.learning-copy h2 {
		max-width: 17ch;
	}

	.learning-copy > p:not(.eyebrow) {
		max-width: 34rem;
		color: rgb(247 244 237 / 78%);
		line-height: 1.6;
		text-wrap: pretty;
	}

	.starting-points {
		display: grid;
		min-width: 0;
		gap: var(--space-md);
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
		gap: var(--space-md);
	}

	.next-step-panel h2 {
		max-width: 16ch;
	}

	.next-step-copy > p {
		max-width: 36rem;
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
		.starting-points {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 52rem) {
		.hero-grid {
			grid-template-columns: minmax(0, 1.55fr) minmax(17rem, 0.65fr);
		}

		.learning-grid {
			grid-template-columns: minmax(18rem, 0.72fr) minmax(0, 1.28fr);
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
