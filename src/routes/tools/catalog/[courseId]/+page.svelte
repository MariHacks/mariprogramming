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
	<title>{data.page.courseCode} · {data.page.title} | {MARITOOLS_NAME}</title>
	<meta
		name="description"
		content={`${data.page.courseCode} ${data.page.title} assessments, books, and forum posts.`}
	/>
</svelte:head>

<div class="mt-preview">
	<section class="page page-catalog">
		<header class="catalog-titlebar">
			<div>
				<span class="catalog-eyebrow">Courses</span>
				<p class="course-code">{data.page.courseCode}</p>
				<h1>{data.page.title}</h1>
			</div>
			<p>
				<a href={resolve('/tools/catalog', {})}>← Catalog</a>
			</p>
		</header>

		{#each data.page.offerings as offering (offering.offeringId)}
			<article class="course-offering">
				<header>
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
										<span>
											{assessment.weight ? `${assessment.weight}` : '—'}
											{#if assessment.date}
												· {assessment.date}
											{/if}
										</span>
										{#if assessment.conflicts?.length}
											<ul class="conflict-inline">
												{#each assessment.conflicts as alt, altIndex (`${offering.offeringId}-a-${index}-c-${altIndex}`)}
													<li>
														Also submitted: {alt.title || 'Untitled'}
														{alt.weight ? ` · ${alt.weight}` : ''}
														{alt.date ? ` · ${alt.date}` : ''}
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
										<span>
											{#if book.author}{book.author}{/if}
											{#if book.isbn} · {book.isbn}{/if}
											{#if book.required} · Required{/if}
										</span>
										{#if book.conflicts?.length}
											<ul class="conflict-inline">
												{#each book.conflicts as alt, altIndex (`${offering.offeringId}-b-${index}-c-${altIndex}`)}
													<li>
														Also submitted: {alt.title || 'Untitled'}
														{alt.author ? ` · ${alt.author}` : ''}
														{alt.isbn ? ` · ${alt.isbn}` : ''}
														{alt.required ? ' · Required' : ' · Optional'}
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
				<a href={`${resolve('/tools/forum', {})}?course=${data.page.courseId}`}>Open in forum</a>
			</header>
			{#if data.page.threads.length}
				<ul class="fact-list">
					{#each data.page.threads as thread (thread.id)}
						<li>
							<a href={resolve('/tools/forum/[threadId]', { threadId: thread.id })}>{thread.title}</a>
							{#if thread.authorDisplayName}
								<span>{thread.authorDisplayName}</span>
							{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<p>No forum threads are tagged with this course yet.</p>
			{/if}
		</section>
	</section>
</div>

<style>
	.course-code {
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.04em;
		margin: 0;
	}
	.course-offering {
		border-top: 1px solid color-mix(in srgb, var(--ink, #1a2332) 14%, transparent);
		padding: 1.25rem 0;
	}
	.course-offering header {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1.25rem;
		margin-bottom: 1rem;
	}
	.conflict-flag {
		color: color-mix(in srgb, #b42318 80%, black);
	}
	.course-panels {
		display: grid;
		gap: 1.5rem;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
	}
	.fact-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.fact-list li {
		border-top: 1px solid color-mix(in srgb, var(--ink, #1a2332) 10%, transparent);
		display: grid;
		gap: 0.25rem;
		padding: 0.65rem 0;
	}
	.conflict-inline {
		color: color-mix(in srgb, #b42318 75%, black);
		font-size: 0.92em;
		list-style: disc;
		margin: 0.25rem 0 0 1.1rem;
		padding: 0;
	}
	.course-forum {
		border-top: 1px solid color-mix(in srgb, var(--ink, #1a2332) 14%, transparent);
		margin-top: 1rem;
		padding-top: 1.25rem;
	}
	.course-forum header {
		align-items: baseline;
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1.25rem;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}
</style>
