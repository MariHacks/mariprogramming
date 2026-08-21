<script>
	import { resolve } from '$app/paths';
	import TeacherCard from '$lib/books/TeacherCard.svelte';
	import { clubContent } from '$lib/content/club';

	/** @type {import('./$types').PageData} */
	export let data;

	const metaDescription =
		'Browse French and English course book lists from the Marianopolis Programming Club.';
</script>

<svelte:head>
	<title>Book Delivery | {clubContent.name}</title>
	<meta name="description" content={metaDescription} />
</svelte:head>

<div class="catalogue-page surface-paper">
	{#if data.launchState === 'live'}
		<section class="catalogue-hero">
			<div class="page-container hero-inner">
				<h1>Choose your course</h1>
				<p>Open a course to choose individual books.</p>
			</div>
		</section>

		<section class="course-directory" aria-label="Course book lists">
			<div class="page-container directory-inner">
				{#if data.courseSummaries.length > 0}
					<ul class="course-grid">
						{#each data.courseSummaries as summary (summary.id)}
							<li>
								<TeacherCard teacher={summary.teacher} course={summary} books={summary.books} />
							</li>
						{/each}
					</ul>
				{:else}
					<div class="empty-catalogue">
						<p>No course lists are available.</p>
						<a class="button-primary" href={resolve('/books/request', {})}>Request a book</a>
					</div>
				{/if}
				<p class="request-cta">
					<a href={resolve('/books/request', {})}>Can't find a book?</a>
				</p>
			</div>
		</section>
	{:else}
		<section class="launch-notice" aria-labelledby="book-delivery-status">
			<div class="page-container launch-notice__inner">
				<p class="launch-status">Coming Soon</p>
				<h1 id="book-delivery-status">Book Delivery is coming soon</h1>
				<p>We are preparing course book lists and campus pickup.</p>
			</div>
		</section>
	{/if}
</div>

<style>
	.catalogue-page {
		min-height: 100%;
		background: var(--paper);
	}

	.launch-notice {
		display: grid;
		min-height: min(38rem, calc(100vh - 8rem));
		align-items: center;
		border-block-end: 1px solid rgb(var(--midnight-rgb) / 18%);
	}

	.launch-notice__inner {
		display: grid;
		max-width: 45rem;
		padding-block: clamp(4rem, 12vw, 8rem);
		gap: 1rem;
	}

	.launch-status {
		margin: 0;
		color: var(--club-blue);
		font-size: var(--text-sm);
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.launch-notice h1 {
		max-width: 14ch;
	}

	.launch-notice__inner > p:last-child {
		max-width: 34rem;
		margin: 0;
		color: var(--graphite);
		font-size: var(--text-lg);
		line-height: 1.5;
	}

	.catalogue-hero {
		border-block-end: 1px solid rgb(var(--midnight-rgb) / 18%);
	}

	.hero-inner {
		display: grid;
		justify-items: start;
		padding-block: clamp(3.25rem, 7vw, 5.75rem) clamp(2.25rem, 4vw, 3.5rem);
		gap: var(--space-sm);
	}

	.hero-inner h1 {
		max-width: 12ch;
	}

	.hero-inner p {
		max-width: 36rem;
		margin: 0;
		color: var(--graphite);
		font-size: var(--text-lg);
		line-height: 1.45;
	}

	.course-directory {
		background: var(--paper);
	}

	.directory-inner {
		padding-block: clamp(2rem, 5vw, 4rem) clamp(3rem, 7vw, 6rem);
	}

	.course-grid {
		display: grid;
		width: 100%;
		margin: 0 auto;
		padding: 0;
		border-block-start: 1px solid rgb(var(--midnight-rgb) / 24%);
		list-style: none;
	}

	.course-grid li {
		min-width: 0;
		padding: clamp(1.5rem, 4vw, 2.5rem) 0;
		border-block-end: 1px solid rgb(var(--midnight-rgb) / 24%);
	}

	.empty-catalogue,
	.request-cta {
		display: grid;
		justify-items: start;
		gap: 1rem;
		margin: 0;
		padding-block: var(--space-xl);
		color: var(--graphite);
		font-size: var(--text-lg);
		line-height: 1.45;
	}

	.empty-catalogue {
		border-block: 1px solid rgb(var(--midnight-rgb) / 24%);
	}

	@media (min-width: 46rem) {
		.course-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.course-grid li {
			padding-inline: clamp(1.5rem, 3vw, 2.5rem);
		}

		.course-grid li:nth-child(even) {
			border-inline-start: 1px solid rgb(var(--midnight-rgb) / 18%);
		}
	}

	@media (min-width: 72rem) {
		.course-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.course-grid li:nth-child(even) {
			border-inline-start: 0;
		}

		.course-grid li:not(:nth-child(3n + 1)) {
			border-inline-start: 1px solid rgb(var(--midnight-rgb) / 18%);
		}
	}

	@media (forced-colors: active) {
		.catalogue-hero,
		.course-grid,
		.course-grid li,
		.empty-catalogue {
			border-color: CanvasText;
		}
	}
</style>
