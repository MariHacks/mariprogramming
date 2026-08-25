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

<section class="events-page surface-paper editorial-page">
	<div class="page-container events-frame editorial-frame editorial-frame--split">
		<SectionIntro title="Events" />

		<section class="schedule editorial-rail" aria-labelledby="schedule-title">
			<h2 id="schedule-title">Upcoming</h2>
			<EventList events={upcomingEvents} />
		</section>

		<nav class="event-alternatives editorial-rail" aria-label="Other ways to take part">
			<a class="ruled-link" href={resolve('/our-workshops', {})}>
				<span>Browse workshop archive</span>
				<span aria-hidden="true">→</span>
			</a>
			<a class="ruled-link" href={resolve('/resources', {})}>
				<span>Browse resources</span>
				<span aria-hidden="true">→</span>
			</a>
			<a class="ruled-link" href={discordUrl} target="_blank" rel="external noopener noreferrer">
				<span>Join Discord</span>
				<span aria-hidden="true">↗</span>
			</a>
		</nav>
	</div>
</section>

<style>
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

	.event-alternatives {
		display: grid;
		border-block: var(--rule);
	}

	.event-alternatives .ruled-link {
		border-block-end: 0;
	}

	.event-alternatives .ruled-link + .ruled-link {
		border-block-start: var(--rule);
	}

	@media (min-width: 52rem) {
		.schedule {
			grid-row: 1;
		}

		.event-alternatives {
			margin-block-start: calc(-1 * var(--space-lg));
		}
	}
</style>
