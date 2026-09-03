<script>
	import { resolve } from '$app/paths';
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { ACADEMIC_TERMS } from '$lib/maritools/term/calendar.js';

	export let data;

	/** @param {string} termId */
	function termLabel(termId) {
		return ACADEMIC_TERMS.find((term) => term.id === termId)?.name ?? termId;
	}
</script>

<svelte:head>
	<title>{data.page.courseCode}: {data.page.title} | {MARITOOLS_NAME}</title>
	<meta
		name="description"
		content={`${data.page.courseCode} ${data.page.title} assessments, books, and forum posts.`}
	/>
</svelte:head>

<div class="mt-preview">
	<section class="page page-catalog page-course-detail">
		<header class="catalog-titlebar course-detail-titlebar">
			<div>
				<span class="catalog-eyebrow">Courses</span>
				<p class="course-code">{data.page.courseCode}</p>
				<h1>{data.page.title}</h1>
			</div>
			<p>
				<a class="course-back-link" href={resolve('/tools/catalog', {})}
					><span aria-hidden="true">←</span> Catalog</a
				>
			</p>
		</header>

		<div class="course-detail-body">
			{#each data.page.offerings as offering (offering.offeringId)}
				<article class="course-offering">
					<header class="offering-meta">
						<strong>Section {offering.section || '—'}</strong>
						<span>{offering.teacherName || 'Teacher TBD'}</span>
						<span>{termLabel(offering.termId)}</span>
						{#if offering.hasConflicts}
							<span class="conflict-flag">Has conflicting submissions</span>
						{/if}
					</header>

					<div class="course-panels">
						<div>
							<h2>Assessments</h2>
							{#if offering.assessments.length}
								<ul class="fact-list">
									{#each offering.assessments as assessment, index (`${offering.offeringId}-a-${index}`)}
										<li>
											<strong>{assessment.title || 'Untitled'}</strong>
											<span class="fact-meta">
												<span>{assessment.weight ? `${assessment.weight}` : '—'}</span>
												{#if assessment.date}<span>{assessment.date}</span>{/if}
											</span>
											{#if assessment.conflicts?.length}
												<ul class="conflict-inline">
													{#each assessment.conflicts as alt, altIndex (`${offering.offeringId}-a-${index}-c-${altIndex}`)}
														<li>
															Also submitted: {alt.title || 'Untitled'}{alt.weight
																? `, ${alt.weight}`
																: ''}{alt.date ? `, ${alt.date}` : ''}
														</li>
													{/each}
												</ul>
											{/if}
										</li>
									{/each}
								</ul>
							{:else}
								<p>No assessments were shared for this section.</p>
							{/if}
						</div>
						<div>
							<h2>Books (reference only)</h2>
							{#if offering.books.length}
								<ul class="fact-list">
									{#each offering.books as book, index (`${offering.offeringId}-b-${index}`)}
										<li>
											<strong>{book.title || 'Untitled'}</strong>
											<span class="fact-meta">
												{#if book.author}<span>{book.author}</span>{/if}
												{#if book.isbn}<span>{book.isbn}</span>{/if}
												{#if book.required}<span>Required</span>{/if}
											</span>
											{#if book.conflicts?.length}
												<ul class="conflict-inline">
													{#each book.conflicts as alt, altIndex (`${offering.offeringId}-b-${index}-c-${altIndex}`)}
														<li>
															Also submitted: {alt.title || 'Untitled'}{alt.author
																? `, ${alt.author}`
																: ''}{alt.isbn ? `, ${alt.isbn}` : ''}{alt.required
																? ', Required'
																: ', Optional'}
														</li>
													{/each}
												</ul>
											{/if}
										</li>
									{/each}
								</ul>
							{:else}
								<p>No book reference was shared for this section.</p>
							{/if}
						</div>
					</div>
				</article>
			{/each}

			<section class="course-forum">
				<header>
					<h2>Forum posts for this course</h2>
					<a href={resolve(`/tools/forum?course=${data.page.courseId}`)}>Open in forum</a>
				</header>
				{#if data.page.threads.length}
					<ul class="fact-list">
						{#each data.page.threads as thread (thread.id)}
							<li>
								<a href={resolve('/tools/forum/[threadId]', { threadId: thread.id })}
									>{thread.title}</a
								>
								{#if thread.authorDisplayName}
									<span class="fact-meta">{thread.authorDisplayName}</span>
								{/if}
							</li>
						{/each}
					</ul>
				{:else}
					<p>No forum threads are tagged with this course yet.</p>
				{/if}
			</section>
		</div>
	</section>
</div>

<style>
	.course-detail-titlebar {
		align-items: flex-end;
	}
	.course-detail-titlebar > div {
		min-width: 0;
	}
	.course-detail-titlebar h1 {
		max-width: 24ch;
		font-size: clamp(2rem, 4vw, 2.5rem);
		overflow-wrap: anywhere;
	}
	.course-code {
		color: var(--ink-soft);
		font-size: 0.75rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.04em;
		margin: 0;
	}
	.course-back-link {
		display: inline-flex;
		gap: 0.35rem;
		font-weight: 600;
		white-space: nowrap;
	}
	.course-detail-body {
		flex: 1 1 auto;
		width: 100%;
	}
	.course-offering {
		padding: 1.5rem clamp(1.25rem, 3vw, 3rem) 2rem;
		border-bottom: 1px solid var(--rule);
	}
	.offering-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1.25rem;
		margin-bottom: 1.5rem;
		color: var(--steel);
		font-size: 0.8125rem;
	}
	.offering-meta strong {
		color: var(--ink);
	}
	.conflict-flag {
		color: color-mix(in srgb, #b42318 80%, black);
	}
	.course-panels {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: clamp(2rem, 5vw, 4rem);
	}
	.course-panels > div {
		min-width: 0;
	}
	.course-panels h2,
	.course-forum h2 {
		width: auto;
		margin: 0;
		font-size: 1.5rem;
		line-height: 1.15;
	}
	.course-panels h2 {
		padding-bottom: 0.65rem;
		border-bottom: 1px solid var(--rule);
	}
	.fact-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.fact-list li {
		display: grid;
		gap: 0.25rem;
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--rule);
	}
	.fact-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1rem;
		color: var(--steel);
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
	}
	.conflict-inline {
		color: color-mix(in srgb, #b42318 75%, black);
		font-size: 0.92em;
		list-style: disc;
		margin: 0.25rem 0 0 1.1rem;
		padding: 0;
	}
	.course-forum {
		padding: 1.75rem clamp(1.25rem, 3vw, 3rem) 2.5rem;
	}
	.course-forum header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1.25rem;
		justify-content: space-between;
		margin-bottom: 1rem;
	}
	.course-forum header a {
		font-size: 0.8125rem;
		font-weight: 600;
		white-space: nowrap;
	}
	.course-forum > p {
		color: var(--steel);
		font-size: 0.8125rem;
	}
	@media (max-width: 44rem) {
		.course-detail-titlebar {
			align-items: flex-start;
		}
		.course-detail-titlebar h1 {
			font-size: 2rem;
		}
		.course-panels {
			grid-template-columns: 1fr;
			gap: 2rem;
		}
		.course-forum header {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
