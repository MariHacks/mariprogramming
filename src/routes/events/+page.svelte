<script>
	import EventList from '$lib/components/site/EventList.svelte';
	import SectionIntro from '$lib/components/site/SectionIntro.svelte';
	import { clubContent, getUpcomingEvents } from '$lib/content/club';

	// The helper's shared typedef describes only its filter fields; the records retain their full shape.
	const upcomingEvents = /** @type {Array<{
	 * id: string,
	 * startsAt: string,
	 * title: string,
	 * description?: string
	 * }>} */ (/** @type {unknown} */ (getUpcomingEvents(clubContent.events)));
	const metaDescription =
		'Find confirmed Marianopolis Programming Club event dates and use the workshop archive between sessions.';
</script>

<svelte:head>
	<title>Events | {clubContent.name}</title>
	<meta name="description" content={metaDescription} />
</svelte:head>

<section class="events-hero surface-paper">
	<div class="page-container hero-grid">
		<SectionIntro
			eyebrow="Club schedule"
			title="Events, once they’re confirmed"
			summary="Every confirmed club event will appear here with its date, time, and details."
		/>

		<aside class="listing-standard" aria-label="Event listing standard">
			<p class="utility-label">Listing standard</p>
			<p class="standard-title">Dates you can plan around</p>
			<p>We publish an event only after its time and format are set.</p>
		</aside>
	</div>
</section>

<section class="schedule-section surface-paper" aria-labelledby="schedule-title">
	<div class="page-container schedule-frame">
		<header class="schedule-heading">
			<div>
				<p class="eyebrow">Current listings</p>
				<h2 id="schedule-title">Programming Club schedule</h2>
			</div>
			<p>Use this list for the date, time, and latest details of every upcoming event.</p>
		</header>

		<EventList events={upcomingEvents} />
	</div>
</section>

<section class="between-events surface-navy" aria-labelledby="between-events-title">
	<div class="page-container between-events-grid">
		<div>
			<p class="eyebrow">Learn between events</p>
			<h2 id="between-events-title">Work through a past workshop</h2>
		</div>

		<div class="between-events-copy">
			<p>The archive has original club slides and exercises you can use at your own pace.</p>
			<a class="button-secondary" href="/our-workshops">Browse workshop archive</a>
		</div>
	</div>
</section>

<style>
	.events-hero {
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

	.listing-standard {
		display: grid;
		min-width: 0;
		padding-block-start: var(--space-md);
		border-block-start: 1px solid var(--color-border-strong);
		gap: var(--space-sm);
	}

	.standard-title {
		max-width: 18ch;
		color: var(--midnight);
		font-family: var(--font-display);
		font-size: var(--text-xl);
		font-weight: 600;
		letter-spacing: -0.025em;
		line-height: 1.2;
		text-wrap: balance;
	}

	.listing-standard > p:last-child {
		max-width: 32rem;
		line-height: 1.6;
		text-wrap: pretty;
	}

	.schedule-section {
		padding-block: 0 var(--section-space);
	}

	.schedule-frame {
		display: grid;
		min-width: 0;
		padding-block-start: clamp(2rem, 5vw, 3.5rem);
		border-block-start: 1px solid var(--color-border-strong);
		gap: clamp(2rem, 5vw, 3.5rem);
	}

	.schedule-heading {
		display: grid;
		align-items: end;
		min-width: 0;
		gap: var(--space-lg);
	}

	.schedule-heading > div {
		display: grid;
		min-width: 0;
		gap: var(--space-sm);
	}

	.schedule-heading h2 {
		max-width: 20ch;
	}

	.schedule-heading > p {
		max-width: 34rem;
		line-height: 1.6;
		text-wrap: pretty;
	}

	.between-events {
		padding-block: var(--section-space);
	}

	.between-events-grid {
		display: grid;
		align-items: start;
		gap: clamp(2rem, 7vw, 6rem);
	}

	.between-events-grid > div {
		display: grid;
		min-width: 0;
		gap: var(--space-md);
	}

	.between-events-grid h2 {
		max-width: 19ch;
	}

	.between-events-copy {
		justify-items: start;
	}

	.between-events-copy p {
		max-width: 34rem;
		color: rgb(247 244 237 / 78%);
		line-height: 1.6;
		text-wrap: pretty;
	}

	@media (min-width: 52rem) {
		.hero-grid {
			grid-template-columns: minmax(0, 1.45fr) minmax(18rem, 0.65fr);
		}

		.schedule-heading,
		.between-events-grid {
			grid-template-columns: minmax(0, 0.9fr) minmax(19rem, 1.1fr);
		}
	}
</style>
