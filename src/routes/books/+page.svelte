<script>
	import TeacherCard from '$lib/books/TeacherCard.svelte';
	import SectionIntro from '$lib/components/site/SectionIntro.svelte';
	import { clubContent } from '$lib/content/club';

	/** @type {import('./$types').PageData} */
	export let data;

	const metaDescription =
		'Browse teacher-organized French and English course book lists from the Marianopolis Programming Club.';
</script>

<svelte:head>
	<title>Book Delivery | {clubContent.name}</title>
	<meta name="description" content={metaDescription} />
</svelte:head>

<div class="catalogue-page surface-paper">
	<section class="catalogue-hero">
		<div class="page-container hero-inner">
			<div class="intro-copy">
				<SectionIntro
					eyebrow="Book Delivery"
					title="Start with your teacher"
					summary="Choose the instructor shown on your schedule to see the books assigned to each French or English course."
				/>
			</div>
		</div>
	</section>

	<section class="teacher-directory surface-navy" aria-labelledby="teacher-directory-heading">
		<div class="page-container directory-inner">
			<header class="directory-header">
				<div class="directory-title">
					<p class="utility-label">Course list directory</p>
					<h2 id="teacher-directory-heading">Available teacher lists</h2>
				</div>
				<p class="directory-note">Match the course code on your schedule before opening a list.</p>
			</header>

			<ul class="teacher-grid">
				{#each data.teacherSummaries as summary (summary.teacher.id)}
					<li>
						<TeacherCard
							teacher={summary.teacher}
							courses={summary.courses}
							books={summary.books}
						/>
					</li>
				{/each}
			</ul>
		</div>
	</section>
</div>

<style>
	.catalogue-page {
		min-height: 100%;
	}

	.catalogue-hero {
		border-block-end: 1px solid rgb(5 13 46 / 18%);
	}

	.hero-inner {
		padding-block: clamp(4.5rem, 9vw, 8rem);
	}

	.intro-copy {
		width: min(100%, 58rem);
	}

	.teacher-directory {
		border-block-start: 0.375rem solid var(--sky);
	}

	.directory-inner {
		padding-block: clamp(3.5rem, 7vw, 6.5rem);
	}

	.directory-header {
		display: grid;
		align-items: end;
		padding-block-end: clamp(1.5rem, 4vw, 2.5rem);
		border-block-end: 1px solid rgb(153 194 255 / 34%);
		gap: var(--space-md);
	}

	.directory-title {
		display: grid;
		min-width: 0;
		gap: var(--space-sm);
	}

	.directory-title h2 {
		max-width: 18ch;
		font-size: var(--text-3xl);
	}

	.directory-note {
		max-width: 38ch;
		color: rgb(247 244 237 / 76%);
		font-size: var(--text-lg);
		line-height: 1.55;
		text-wrap: pretty;
	}

	.teacher-grid {
		display: grid;
		margin: clamp(2rem, 5vw, 3.5rem) 0 0;
		padding: 0;
		gap: clamp(1.5rem, 3vw, 2.5rem);
		list-style: none;
	}

	.teacher-grid li {
		min-width: 0;
	}

	@media (min-width: 48rem) {
		.directory-header {
			grid-template-columns: minmax(0, 1fr) minmax(16rem, 0.55fr);
			column-gap: var(--space-xl);
		}
	}

	@media (min-width: 62rem) {
		.teacher-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (forced-colors: active) {
		.catalogue-hero,
		.teacher-directory,
		.directory-header {
			border-color: CanvasText;
		}
	}
</style>
