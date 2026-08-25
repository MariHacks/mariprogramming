<script>
	import { resolve } from '$app/paths';
	import EventList from '$lib/components/site/EventList.svelte';
	import SectionIntro from '$lib/components/site/SectionIntro.svelte';
	import { clubContent, getUpcomingEvents } from '$lib/content/club';

	const upcomingEvents =
		/** @type {Array<{
		 * id: string,
		 * startsAt: string,
		 * title: string,
		 * description?: string
		 * }>} */ (/** @type {unknown} */ (getUpcomingEvents(clubContent.events)));
	const metaDescription = 'Confirmed Marianopolis Programming Club event dates.';
	const discordUrl = clubContent.socialLinks.find(({ label }) => label === 'Discord')?.url;
</script>

<svelte:head>
	<title>Events | {clubContent.name}</title>
	<meta name="description" content={metaDescription} />
</svelte:head>

<section class="events-page surface-paper">
	<div class="page-container events-frame">
		<SectionIntro title="Events" />

		<section class="schedule" aria-labelledby="schedule-title">
			<h2 id="schedule-title">Upcoming</h2>
			<EventList events={upcomingEvents} />
		</section>

		<nav class="event-alternatives" aria-label="Other ways to take part">
			<a class="archive-link" href={resolve('/our-workshops', {})}>
				<span>Browse workshop archive</span>
				<span aria-hidden="true">→</span>
			</a>
			<a class="archive-link" href={resolve('/resources', {})}>
				<span>Browse resources</span>
				<span aria-hidden="true">→</span>
			</a>
			<a class="archive-link" href={discordUrl} target="_blank" rel="external noopener noreferrer">
				<span>Join Discord</span>
				<span aria-hidden="true">↗</span>
			</a>
		</nav>
	</div>
</section>

<style>
	.events-page {
		min-height: calc(100vh - 4.5rem - 4.9375rem);
		border-block-end: var(--rule);
	}

	.events-frame {
		display: grid;
		padding-block: clamp(3.5rem, 7vw, 6rem);
		gap: clamp(2.5rem, 6vw, 5rem);
	}

	.events-frame :global(.section-intro) {
		align-content: start;
		max-width: 36rem;
	}

	.schedule {
		display: grid;
		align-content: start;
		min-width: 0;
		gap: var(--space-md);
	}

	.schedule > h2 {
		font-family: var(--font-body);
		font-size: var(--text-sm);
		font-weight: 700;
		letter-spacing: 0;
		line-height: 1.4;
	}

	.archive-link {
		display: grid;
		grid-template-columns: minmax(0, 1fr) max-content;
		align-items: center;
		min-height: 3.75rem;
		padding: 0.75rem var(--space-2xs);
		border-block: var(--rule);
		color: var(--club-blue);
		font-size: var(--text-sm);
		font-weight: 700;
		line-height: 1.35;
		text-decoration: none;
		column-gap: var(--space-sm);
		transition:
			background-color var(--motion-fast) var(--ease-out),
			color var(--motion-fast) var(--ease-out),
			transform var(--motion-press) var(--ease-out);
	}

	.event-alternatives {
		display: grid;
		border-block: var(--rule);
	}

	.event-alternatives .archive-link {
		border-block: 0;
	}

	.event-alternatives .archive-link + .archive-link {
		border-block-start: var(--rule);
	}

	.archive-link:hover {
		background: var(--mist);
		color: var(--midnight);
	}

	.archive-link:active {
		transform: translateY(var(--press-distance));
	}

	@media (min-width: 52rem) {
		.events-frame {
			grid-template-columns: minmax(15rem, 0.68fr) minmax(0, 1.32fr);
			align-items: start;
		}

		.schedule,
		.event-alternatives {
			grid-column: 2;
		}

		.schedule {
			grid-row: 1;
		}

		.event-alternatives {
			margin-block-start: calc(-1 * var(--space-lg));
		}
	}

	@media (max-width: 43.749rem) {
		.events-page {
			min-height: calc(100vh - 4.25rem - 6.5rem);
		}
	}
</style>
