<script>
	import SectionIntro from '$lib/components/site/SectionIntro.svelte';
	import { clubContent } from '$lib/content/club';

	const metaDescription =
		'Learn when teacher course-book lists will be available through the Marianopolis Programming Club.';
</script>

<svelte:head>
	<title>Book Delivery | {clubContent.name}</title>
	<meta name="description" content={metaDescription} />
</svelte:head>

<section class="entry-page surface-paper">
	<div class="page-container page-section entry-grid">
		<SectionIntro
			eyebrow="Book Delivery"
			title="Course books, organized by teacher"
			summary="Book Delivery will make it easier to start with the list that matches your Marianopolis course."
		/>

		<section class="status-panel surface-navy" aria-labelledby="book-list-status">
			<p class="utility-label">Current status</p>
			<h2 id="book-list-status">Teacher lists are being prepared</h2>
			<p>
				Return when your course list is available. You’ll be able to review the books assigned by
				your teacher and choose only what you need.
			</p>
			<a class="button-secondary" href="/">Explore the club</a>
		</section>
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
		max-width: 18ch;
		font-size: var(--text-2xl);
	}

	.status-panel p:not(.utility-label) {
		color: rgb(247 244 237 / 78%);
		line-height: 1.6;
		text-wrap: pretty;
	}

	.status-panel .button-secondary {
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
