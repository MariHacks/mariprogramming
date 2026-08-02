<script>
	import { formatCad } from '../format';
	import BookCoverStack from './BookCoverStack.svelte';

	/**
	 * @typedef {{ id: string, slug: string, name: string }} Teacher
	 * @typedef {{ id: string, teacherId: string, code: string, title: string }} Course
	 * @typedef {{
	 *   id: string,
	 *   courseId: string,
	 *   title: string,
	 *   author: string,
	 *   format: string,
	 *   priceCents: number,
	 *   bookstoreId: string,
	 *   storefrontUrl: string | null,
	 *   coverUrl: string | null,
	 *   coverTheme: string
	 * }} Book
	 */

	/** @type {Teacher} */
	export let teacher;

	/** @type {Course[]} */
	export let courses = [];

	/** @type {Book[]} */
	export let books = [];

	$: prices = books.map((book) => book.priceCents);
	$: minimumPrice = prices.length ? Math.min(...prices) : null;
	$: maximumPrice = prices.length ? Math.max(...prices) : null;
	$: priceRange =
		minimumPrice === null || maximumPrice === null
			? 'Price not listed'
			: minimumPrice === maximumPrice
				? formatCad(minimumPrice)
				: `${formatCad(minimumPrice)} to ${formatCad(maximumPrice)}`;
	$: bookstoreCount = new Set(books.map((book) => book.bookstoreId)).size;
	$: bookCountLabel = `${books.length} required ${books.length === 1 ? 'book' : 'books'}`;
	$: bookstoreCountLabel = `${bookstoreCount} ${bookstoreCount === 1 ? 'bookstore' : 'bookstores'}`;
</script>

<article class="teacher-card">
	<a class="teacher-card-link" href={`/books/${teacher.slug}`}>
		<div class="cover-field">
			<span class="list-marker">Assigned reading</span>
			<BookCoverStack {books} />
		</div>

		<div class="card-content">
			<header>
				<h3>{teacher.name}</h3>
			</header>

			<div class="course-section">
				<p class="section-label">Courses</p>
				<ul class="course-list">
					{#each courses as course (course.id)}
						<li>
							<span class="course-code">{course.code}</span>
							<span class="course-name">{course.title}</span>
						</li>
					{/each}
				</ul>
			</div>

			<dl class="list-facts">
				<div class="list-fact">
					<dt>List size</dt>
					<dd>{bookCountLabel}</dd>
				</div>
				<div class="list-fact">
					<dt>Individual book prices</dt>
					<dd>{priceRange}</dd>
				</div>
				<div class="list-fact">
					<dt>Sources</dt>
					<dd>{bookstoreCountLabel}</dd>
				</div>
			</dl>

			<span class="card-action">
				View assigned books
				<svg viewBox="0 0 20 20" aria-hidden="true">
					<path d="M4 10h11M11 6l4 4-4 4" />
				</svg>
			</span>
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
		display: grid;
		grid-template-rows: auto 1fr;
		min-width: 0;
		height: 100%;
		border: 1px solid rgb(5 13 46 / 20%);
		border-radius: var(--radius-md);
		background: var(--paper);
		box-shadow: var(--shadow-sm);
		color: var(--graphite);
		text-decoration: none;
		transition:
			border-color var(--motion-fast) var(--ease-out),
			box-shadow var(--motion-base) var(--ease-out),
			transform var(--motion-fast) var(--ease-out);
	}

	.teacher-card-link:focus-visible {
		border-color: var(--club-blue);
		outline: 3px solid var(--color-focus);
		outline-offset: 4px;
		box-shadow: var(--shadow-md);
	}

	.cover-field {
		position: relative;
		display: grid;
		place-items: center;
		min-height: clamp(14rem, 43vw, 17rem);
		padding: 2.75rem var(--space-lg) var(--space-md);
		border-block-end: 1px solid rgb(5 13 46 / 22%);
		border-start-start-radius: calc(var(--radius-md) - 1px);
		border-start-end-radius: calc(var(--radius-md) - 1px);
		background: var(--sky);
	}

	.list-marker {
		position: absolute;
		inset-block-start: var(--space-sm);
		inset-inline-start: var(--space-sm);
		padding: 0.35rem 0.55rem;
		border: 1px solid rgb(5 13 46 / 36%);
		border-radius: var(--radius-pill);
		background: var(--paper);
		color: var(--midnight);
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		line-height: 1.2;
		text-transform: uppercase;
	}

	.card-content {
		display: grid;
		align-content: start;
		min-width: 0;
		padding: clamp(1.25rem, 5cqi, 1.75rem);
		gap: var(--space-md);
	}

	.section-label,
	dt,
	.course-code {
		color: var(--club-blue);
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		line-height: 1.4;
		text-transform: uppercase;
	}

	h3 {
		max-width: 22ch;
		color: var(--midnight);
		font-size: clamp(1.45rem, 7cqi, 2rem);
		overflow-wrap: anywhere;
	}

	.course-section {
		display: grid;
		gap: var(--space-2xs);
	}

	.course-list {
		margin: 0;
		padding: 0;
		border-block-start: 1px solid rgb(5 13 46 / 18%);
		list-style: none;
	}

	.course-list li {
		display: grid;
		grid-template-columns: minmax(4.5rem, auto) minmax(0, 1fr);
		align-items: baseline;
		column-gap: var(--space-sm);
		padding-block: 0.6rem;
		border-block-end: 1px solid rgb(5 13 46 / 18%);
	}

	.course-code {
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.04em;
	}

	.course-name {
		min-width: 0;
		color: var(--midnight);
		font-weight: 600;
		line-height: 1.35;
		overflow-wrap: anywhere;
	}

	.list-facts {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		margin: 0;
		border-block: 1px solid rgb(5 13 46 / 18%);
	}

	.list-fact {
		display: grid;
		align-content: start;
		min-width: 0;
		padding: var(--space-xs);
		gap: 0.35rem;
	}

	.list-fact + .list-fact {
		border-inline-start: 1px solid rgb(5 13 46 / 18%);
	}

	dt,
	dd {
		min-width: 0;
		margin: 0;
		overflow-wrap: anywhere;
	}

	dt {
		font-size: 0.625rem;
	}

	dd {
		color: var(--midnight);
		font-size: var(--text-sm);
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		line-height: 1.35;
	}

	.card-action {
		display: inline-flex;
		align-items: center;
		justify-self: start;
		color: var(--club-blue);
		font-size: var(--text-sm);
		font-weight: 700;
		line-height: 1.3;
		gap: var(--space-2xs);
	}

	.card-action svg {
		width: 1.1rem;
		height: 1.1rem;
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 1.6;
		transition: transform var(--motion-fast) var(--ease-out);
	}

	@media (hover: hover) and (pointer: fine) {
		.teacher-card-link:hover {
			border-color: var(--club-blue);
			box-shadow: var(--shadow-md);
			transform: translateY(-0.1875rem);
		}

		.teacher-card-link:hover .card-action svg {
			transform: translateX(0.2rem);
		}
	}

	@container (max-width: 22rem) {
		.cover-field {
			min-height: 13.5rem;
			padding-inline: var(--space-sm);
		}

		.list-facts {
			grid-template-columns: 1fr;
		}

		.list-fact {
			grid-template-columns: minmax(7rem, 0.8fr) minmax(0, 1.2fr);
			align-items: baseline;
		}

		.list-fact + .list-fact {
			border-block-start: 1px solid rgb(5 13 46 / 18%);
			border-inline-start: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.teacher-card-link,
		.card-action svg {
			transition: none;
		}

		.teacher-card-link:hover,
		.teacher-card-link:hover .card-action svg {
			transform: none;
		}
	}

	@media (forced-colors: active) {
		.teacher-card-link,
		.list-marker,
		.course-list,
		.course-list li,
		.list-facts,
		.list-fact + .list-fact {
			border-color: CanvasText;
		}

		.cover-field {
			border-color: CanvasText;
			background: Canvas;
		}
	}
</style>
