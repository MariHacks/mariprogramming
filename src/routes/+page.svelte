<script>
	import ContentCard from '$lib/components/site/ContentCard.svelte';
	import SectionIntro from '$lib/components/site/SectionIntro.svelte';
	import { clubContent, getUpcomingEvents } from '$lib/content/club';

	const workshopPath = clubContent.workshops.slice(0, 3);
	const upcomingEvents = getUpcomingEvents(clubContent.events);
</script>

<svelte:head>
	<title>{clubContent.name}</title>
	<meta name="description" content={clubContent.mission} />
</svelte:head>

<section class="home-hero surface-paper">
	<div class="page-container hero-grid">
		<SectionIntro
			eyebrow="Programming at Marianopolis"
			title="Learn programming. Build together."
			summary={clubContent.mission}
		/>

		<div class="hero-next-step">
			<p class="utility-label">Start here</p>
			<p>
				Follow club updates, meet the community, and find out when the next session is happening.
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
				<a class="button-secondary" href="/about-us">Meet the club</a>
			</div>
		</div>
	</div>
</section>

<section class="workshop-section surface-navy" aria-labelledby="workshop-path-title">
	<div class="page-container home-section">
		<div class="section-heading workshop-heading">
			<div>
				<p class="eyebrow">Workshop path</p>
				<h2 id="workshop-path-title">Start with Python foundations</h2>
			</div>
			<div class="section-note">
				<p>Begin at lesson one, or open the archive and choose the idea you need.</p>
				<a class="button-secondary" href="/our-workshops">Browse every workshop</a>
			</div>
		</div>

		<ol class="workshop-path" aria-label="A three-lesson Python starting path">
			{#each workshopPath as workshop, index (workshop.id)}
				<li>
					<ContentCard
						title={workshop.title}
						summary={workshop.description}
						meta={`Lesson ${index + 1} of ${workshopPath.length}`}
						variant="paper"
					/>
				</li>
			{/each}
		</ol>
	</div>
</section>

<section class="events-section surface-paper" aria-labelledby="events-title">
	<div class="page-container home-section events-grid">
		<header class="section-heading">
			<div>
				<p class="eyebrow">Current schedule</p>
				<h2 id="events-title">Upcoming events</h2>
			</div>
			<p>Dates appear here only after the club confirms them.</p>
		</header>

		<div class="event-status">
			{#if upcomingEvents.length > 0}
				<p class="card-meta">Confirmed schedule</p>
				<h3>
					{upcomingEvents.length}
					{upcomingEvents.length === 1 ? 'event is' : 'events are'} listed
				</h3>
				<a class="button-primary" href="/events">See upcoming events</a>
			{:else}
				<p class="card-meta">No confirmed date yet</p>
				<h3>New events are being planned</h3>
				<p>Follow the club for the next confirmed date and event details.</p>
				<a
					class="button-primary"
					href={clubContent.communityAction.url}
					target="_blank"
					rel="noopener noreferrer"
				>
					{clubContent.communityAction.label}
				</a>
			{/if}
		</div>
	</div>
</section>

<section class="delivery-section surface-paper" aria-labelledby="book-delivery-title">
	<div class="page-container delivery-wrap">
		<div class="delivery-panel">
			<div>
				<p class="eyebrow">New student service</p>
				<h2 id="book-delivery-title">Book Delivery</h2>
			</div>
			<div class="delivery-copy">
				<p>
					Course books organized by teacher, so you can start with the list that matches your class
					and review only the titles you need. The first teacher lists are being prepared.
				</p>
				<a class="button-primary" href="/books">Explore Book Delivery</a>
			</div>
		</div>
	</div>
</section>

<style>
	.home-hero {
		padding-block: clamp(4.5rem, 10vw, 8rem);
	}

	.hero-grid {
		display: grid;
		align-items: end;
		gap: clamp(3rem, 8vw, 8rem);
	}

	.hero-grid :global(.section-intro) {
		max-width: 48rem;
	}

	.hero-next-step {
		display: grid;
		align-content: start;
		min-width: 0;
		padding-block-start: var(--space-md);
		border-block-start: 1px solid var(--color-border-strong);
		gap: var(--space-md);
	}

	.hero-next-step > p:not(.utility-label) {
		line-height: 1.6;
		text-wrap: pretty;
	}

	.action-row {
		display: flex;
		align-items: stretch;
		flex-wrap: wrap;
		gap: var(--space-xs);
	}

	.home-section {
		padding-block: var(--section-space);
	}

	.section-heading {
		display: grid;
		align-items: end;
		gap: var(--space-lg);
	}

	.section-heading > div:first-child {
		display: grid;
		gap: var(--space-sm);
	}

	.section-heading h2 {
		max-width: 18ch;
	}

	.section-heading > p,
	.section-note > p {
		max-width: 34rem;
		line-height: 1.6;
		text-wrap: pretty;
	}

	.workshop-heading {
		margin-block-end: var(--space-xl);
	}

	.section-note {
		display: grid;
		justify-items: start;
		gap: var(--space-md);
	}

	.section-note > p {
		color: rgb(247 244 237 / 78%);
	}

	.workshop-path {
		display: grid;
		margin: 0;
		padding: 0;
		gap: var(--space-md);
		list-style: none;
	}

	.workshop-path li {
		min-width: 0;
	}

	.events-grid {
		display: grid;
		align-items: start;
		gap: clamp(2.5rem, 7vw, 6rem);
	}

	.events-grid > .section-heading {
		padding-block-end: var(--space-lg);
		border-block-end: 1px solid var(--color-border);
	}

	.event-status {
		display: grid;
		align-content: start;
		min-width: 0;
		padding: clamp(1.5rem, 4vw, 2.5rem);
		border: 1px solid var(--color-border);
		border-block-start: 0.375rem solid var(--club-blue);
		border-radius: var(--radius-sm);
		background: var(--paper);
		box-shadow: var(--shadow-sm);
		gap: var(--space-md);
	}

	.event-status h3 {
		max-width: 18ch;
	}

	.event-status > p:not(.card-meta) {
		line-height: 1.6;
		text-wrap: pretty;
	}

	.event-status :is(.button-primary, .button-secondary) {
		width: fit-content;
	}

	.delivery-section {
		padding-block: 0 var(--section-space);
	}

	.delivery-panel {
		display: grid;
		min-width: 0;
		padding: clamp(1.5rem, 5vw, 3.5rem);
		border: 1px solid rgb(13 33 115 / 24%);
		border-radius: var(--radius-md);
		background: rgb(153 194 255 / 24%);
		gap: clamp(2rem, 7vw, 6rem);
	}

	.delivery-panel > div {
		display: grid;
		align-content: start;
		gap: var(--space-sm);
	}

	.delivery-copy {
		justify-items: start;
	}

	.delivery-copy p {
		font-size: var(--text-lg);
		line-height: 1.6;
		text-wrap: pretty;
	}

	.delivery-copy .button-primary {
		margin-block-start: var(--space-xs);
	}

	@media (min-width: 46rem) {
		.workshop-path {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (min-width: 52rem) {
		.hero-grid {
			grid-template-columns: minmax(0, 1.55fr) minmax(17rem, 0.65fr);
		}

		.section-heading,
		.delivery-panel {
			grid-template-columns: minmax(0, 0.9fr) minmax(19rem, 1.1fr);
		}

		.events-grid {
			grid-template-columns: minmax(0, 0.95fr) minmax(19rem, 0.72fr);
		}

		.events-grid > .section-heading {
			padding-block-end: 0;
			border-block-end: 0;
		}
	}

	@media (max-width: 24rem) {
		.action-row :is(.button-primary, .button-secondary),
		.delivery-copy .button-primary {
			width: 100%;
		}
	}
</style>
