<script>
	import { resolve } from '$app/paths';
	import { formatCad } from '../format';
	import BookCoverStack from './BookCoverStack.svelte';

	/** @typedef {{ id?: string, slug: string, name: string }} Teacher */
	/** @typedef {{ id: string, teacherId?: string, code: string, title: string }} Course */
	/**
	 * @typedef {{
	 *   id: string,
	 *   courseId?: string,
	 *   title: string,
	 *   author: string | null,
	 *   format?: string | null,
	 *   priceCents: number,
	 *   bookstoreId?: string,
	 *   storefrontUrl: string | null,
	 *   coverUrl: string | null,
	 *   coverTheme?: string
	 * }} Book
	 */

	/** @type {Teacher} */
	export let teacher;

	/** @type {Course} */
	export let course;

	/** @type {Book[]} */
	export let books = [];

	$: totalPrice = books.reduce((total, book) => total + book.priceCents, 0);
	$: bookSummary =
		books.length === 0
			? 'No books listed'
			: `${books.length} ${books.length === 1 ? 'book' : 'books'}, ${formatCad(totalPrice)} total`;
	$: titleId = `course-${course.id}-title`;
	$: detailsId = `course-${course.id}-details`;
</script>

<article class="teacher-card">
	<a
		class="teacher-card-link"
		href={resolve('/books/[teacherSlug]/[courseId]', {
			teacherSlug: teacher.slug,
			courseId: course.id
		})}
		aria-labelledby={titleId}
		aria-describedby={detailsId}
	>
		<div class="cover-field">
			<span class="card-forward" aria-hidden="true">
				<svg viewBox="0 0 20 20">
					<path d="M4 10h11M11 6l4 4-4 4" />
				</svg>
			</span>
			<BookCoverStack {books} />
		</div>

		<div class="card-content">
			<header>
				<h2 id={titleId}>
					<span class="course-code">{course.code}</span>
					<span class="course-title">{course.title}</span>
				</h2>
			</header>

			<div class="course-details" id={detailsId}>
				<p class="teacher-name">{teacher.name}</p>

				<ul class="book-list" aria-label={`Books for ${course.code}`}>
					{#each books as book (book.id)}
						<li>
							<span>{book.title}</span>
							<span class="book-price">{formatCad(book.priceCents)}</span>
						</li>
					{/each}
				</ul>

				<p class="book-summary">{bookSummary}</p>
			</div>
		</div>
	</a>
</article>

<style>
	.teacher-card {
		container-type: inline-size;
		min-width: 0;
		height: 100%;
	}

	.teacher-card-link {
		position: relative;
		display: grid;
		grid-template-rows: auto 1fr;
		min-width: 0;
		height: 100%;
		background: transparent;
		color: var(--graphite);
		text-decoration: none;
		transition: color var(--motion-fast) var(--ease-out);
	}

	.teacher-card-link:focus-visible {
		outline: 3px solid var(--color-focus);
		outline-offset: 0.35rem;
	}

	.cover-field {
		position: relative;
		display: grid;
		place-items: center;
		min-height: clamp(15rem, 25vw, 18rem);
		padding: var(--space-lg) var(--space-md) var(--space-xl);
		background: transparent;
	}

	.card-forward {
		position: absolute;
		inset-block-start: 0;
		inset-inline-end: 0;
		display: grid;
		width: 2.25rem;
		height: 2.25rem;
		place-items: center;
		border: 1px solid rgb(var(--club-blue-rgb) / 30%);
		border-radius: var(--radius-xs);
		background: transparent;
		color: var(--club-blue);
		transition:
			background-color var(--motion-fast) var(--ease-out),
			border-color var(--motion-fast) var(--ease-out),
			color var(--motion-fast) var(--ease-out),
			transform var(--motion-fast) var(--ease-out);
	}

	.card-forward svg {
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 1.6;
	}

	.card-forward svg {
		width: 1.05rem;
		height: 1.05rem;
	}

	.card-content {
		display: grid;
		align-content: start;
		min-width: 0;
		padding: clamp(1.2rem, 5cqi, 1.6rem) 0 0;
		border-block-start: 1px solid rgb(var(--midnight-rgb) / 20%);
		gap: var(--space-sm);
	}

	.card-content header,
	.card-content h2,
	.course-details {
		display: grid;
		min-width: 0;
	}

	.card-content header,
	.card-content h2 {
		gap: var(--space-3xs);
	}

	.card-content h2,
	.course-code,
	.course-title,
	.teacher-name,
	.book-list,
	.book-summary {
		min-width: 0;
		margin: 0;
	}

	.course-code {
		color: var(--club-blue);
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.045em;
		line-height: 1.4;
		text-transform: uppercase;
	}

	.course-title {
		color: var(--midnight);
		font-family: var(--font-display);
		font-size: clamp(1.35rem, 6cqi, 1.7rem);
		font-weight: 700;
		letter-spacing: -0.035em;
		line-height: 1.12;
		overflow-wrap: anywhere;
		transition: color var(--motion-fast) var(--ease-out);
	}

	.course-details {
		gap: var(--space-sm);
	}

	.teacher-name {
		color: rgb(var(--graphite-rgb) / 76%);
		font-size: var(--text-sm);
		line-height: 1.4;
	}

	.book-list {
		padding: 0;
		border-block-start: 1px solid rgb(var(--midnight-rgb) / 16%);
		list-style: none;
	}

	.book-list li {
		display: flex;
		justify-content: space-between;
		min-width: 0;
		padding-block: 0.55rem;
		border-block-end: 1px solid rgb(var(--midnight-rgb) / 12%);
		color: var(--midnight);
		font-size: 0.8125rem;
		line-height: 1.35;
		gap: var(--space-sm);
	}

	.book-list li span:first-child {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.book-price {
		flex: 0 0 auto;
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		white-space: nowrap;
	}

	.book-summary {
		color: var(--graphite);
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		line-height: 1.35;
	}

	@media (hover: hover) and (pointer: fine) {
		.teacher-card-link:hover .course-title {
			color: var(--club-blue);
		}

		.teacher-card-link:hover .card-forward {
			border-color: var(--club-blue);
			background: var(--club-blue);
			color: var(--paper);
			transform: translateX(0.15rem);
		}
	}

	@container (max-width: 20rem) {
		.cover-field {
			min-height: 13rem;
			padding-inline: var(--space-sm);
		}
	}

	@media (max-width: 45.999rem) and (min-width: 22.001rem) {
		.teacher-card-link {
			grid-template-columns: minmax(7.5rem, 0.72fr) minmax(0, 1.28fr);
			grid-template-rows: none;
			align-items: center;
			gap: var(--space-lg);
		}

		.cover-field {
			min-height: 15rem;
			padding: var(--space-md) var(--space-xs);
		}

		.card-forward {
			inset-inline-end: auto;
			inset-inline-start: 0;
		}

		.card-content {
			padding: 0 0 0 var(--space-lg);
			border-block-start: 0;
			border-inline-start: 1px solid rgb(var(--midnight-rgb) / 20%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.teacher-card-link,
		.card-forward,
		.course-title {
			transition: none;
		}
	}

	@media (forced-colors: active) {
		.card-content,
		.card-forward,
		.book-list,
		.book-list li {
			border-color: CanvasText;
		}

		.card-forward {
			background: Canvas;
			color: CanvasText;
		}
	}
</style>
