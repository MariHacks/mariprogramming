<script>
	import SectionIntro from '$lib/components/site/SectionIntro.svelte';
	import { clubContent } from '$lib/content/club';

	const metaDescription =
		'Find the next Marianopolis Programming Club event announcement and stay connected with the club.';
</script>

<svelte:head>
	<title>Events | {clubContent.name}</title>
	<meta name="description" content={metaDescription} />
</svelte:head>

<section class="entry-page surface-paper">
	<div class="page-container page-section entry-grid">
		<SectionIntro
			eyebrow="Events"
			title="New club events are in the works"
			summary="We’re planning the next opportunities for Marianopolis students to code, learn, and build together."
		/>

		<aside class="status-panel surface-navy" aria-labelledby="events-next-step">
			<p class="utility-label">Next step</p>
			<h2 id="events-next-step">Follow the next announcement</h2>
			<p>
				We publish details after a date and format are confirmed. Follow the club’s Instagram to see
				the next event announcement.
			</p>
			<a
				class="button-primary"
				href={clubContent.communityAction.url}
				target="_blank"
				rel="noopener noreferrer"
			>
				{clubContent.communityAction.label}
			</a>
		</aside>
	</div>
</section>

<style>
	.entry-page {
		min-height: clamp(32rem, 68vh, 48rem);
	}

	.entry-grid {
		display: grid;
		align-items: start;
		gap: clamp(2.5rem, 7vw, 6rem);
	}

	.status-panel {
		display: grid;
		align-content: start;
		min-width: 0;
		padding: clamp(1.5rem, 4vw, 2.5rem);
		border: 1px solid rgb(153 194 255 / 38%);
		border-block-start: 0.375rem solid var(--sky);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-md);
		gap: var(--space-md);
	}

	.status-panel h2 {
		max-width: 17ch;
		font-size: var(--text-2xl);
	}

	.status-panel p:not(.utility-label) {
		color: rgb(247 244 237 / 78%);
		line-height: 1.6;
		text-wrap: pretty;
	}

	.status-panel .button-primary {
		width: fit-content;
		margin-block-start: var(--space-xs);
	}

	@media (min-width: 52rem) {
		.entry-grid {
			grid-template-columns: minmax(0, 1.08fr) minmax(19rem, 0.72fr);
		}

		.status-panel {
			margin-block-start: var(--space-lg);
		}
	}
</style>
