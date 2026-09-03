<script>
	import { resolve } from '$app/paths';
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { ACADEMIC_TERMS } from '$lib/maritools/term/calendar.js';
	import { disciplineFromCourseCode } from './discipline.js';

	export let data;

	/** @type {string | null} */
	let openEntryId = null;
	let sortAscending = true;

	$: if (data.entries.length === 1) {
		openEntryId = data.entries[0]?.id ?? null;
	}

	$: sortedEntries = [...data.entries].sort((left, right) => {
		const compared = String(left.courseCode).localeCompare(String(right.courseCode));
		return sortAscending ? compared : -compared;
	});

	$: filtersActive = Boolean(data.query || data.termId || data.discipline);

	function booksOf(entry) {
		return entry.structured?.books ?? [];
	}

	function assessmentsOf(entry) {
		return entry.structured?.assessments ?? [];
	}

	/** @param {string} id */
	function toggleEntry(id) {
		openEntryId = openEntryId === id ? null : id;
	}

	/** @param {{ structured?: { assessments?: unknown[], books?: unknown[] } }} entry */
	function entrySummary(entry) {
		const assessments = assessmentsOf(entry).length;
		const books = booksOf(entry).length;
		const parts = [];
		if (assessments) parts.push(`${assessments} assessment${assessments === 1 ? '' : 's'}`);
		if (books) parts.push(`${books} reference book${books === 1 ? '' : 's'}`);
		else if (assessments) parts.push('no book listed');
		return parts.length ? parts.join(', ') : 'No structured details yet';
	}

	/** @param {string} termId */
	function termLabel(termId) {
		return ACADEMIC_TERMS.find((term) => term.id === termId)?.name ?? termId;
	}
</script>

<svelte:head>
	<title>Course catalog | {MARITOOLS_NAME}</title>
	<meta
		name="description"
		content="Assessments and books students have shared. Books are reference only."
	/>
</svelte:head>

<div class="mt-preview">
	<section class="page page-catalog">
		<header class="catalog-titlebar">
			<div>
				<span class="catalog-eyebrow">Courses</span>
				<h1>Course catalog</h1>
			</div>
			<p>Assessments and books students have shared. Books are reference only.</p>
		</header>

		<form method="GET" class="index-filters">
			<label class="search-field">
				<span>⌕</span>
				<input
					name="q"
					value={data.query}
					aria-label="Search courses"
					placeholder="Course code, title, or teacher"
				/>
			</label>
			<label>
				<span>Term</span>
				<select name="term">
					<option value="">All terms</option>
					{#each ACADEMIC_TERMS as term (term.id)}
						<option value={term.id} selected={term.id === data.termId}>{term.name}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Discipline</span>
				<select name="discipline" aria-label="Discipline">
					<option value="">All disciplines</option>
					{#each data.disciplines ?? [] as option (option)}
						<option value={option} selected={option === data.discipline}>{option}</option>
					{/each}
				</select>
			</label>
			<button type="submit" class="dark-button">Search</button>
		</form>

		{#if data.unavailable}
			<div class="catalog-empty" role="status">
				<strong>Catalog data is not loading right now</strong>
				<p>Try again in a moment. Your filters are unchanged.</p>
			</div>
		{:else if data.entries.length === 0}
			<div class="catalog-empty" role="status">
				{#if filtersActive}
					<strong>No courses match these filters</strong>
					<p>Try another term, discipline, or search phrase.</p>
					<a href={resolve('/tools/catalog', {})}>Clear filters</a>
				{:else}
					<strong>No published courses yet</strong>
					<p>Shared outlines will show up here after students review and publish course facts.</p>
				{/if}
			</div>
		{:else}
			<div class="catalog-count">
				<strong>{data.entries.length} course{data.entries.length === 1 ? '' : 's'}</strong>
				<span>
					{#if filtersActive}
						Filtered results from reviewed student outlines
					{:else}
						Updated from reviewed student outlines
					{/if}
				</span>
				<button type="button" on:click={() => (sortAscending = !sortAscending)}>
					Sort by course code {sortAscending ? '↓' : '↑'}
				</button>
			</div>
			<div class="catalog-index">
				<div class="catalog-head">
					<span>Code</span><span>Course</span><span>Category</span><span>Section / teacher</span
					><span>Term</span><span></span>
				</div>
				{#each sortedEntries as entry (entry.id)}
					<article class="catalog-row" class:catalog-row--open={openEntryId === entry.id}>
						<span class="course-code">{entry.courseCode}</span>
						<div>
							<h2>
								{#if entry.courseId}
									<a href={resolve('/tools/catalog/[courseId]', { courseId: entry.courseId })}
										>{entry.title}</a
									>
								{:else}
									{entry.title}
								{/if}
							</h2>
							<p>{entrySummary(entry)}</p>
						</div>
						<span>{disciplineFromCourseCode(entry.courseCode)}</span>
						<span>{entry.section}<br /><small>{entry.teacherName}</small></span>
						<span>{termLabel(entry.termId)}</span>
						<button
							type="button"
							class="catalog-toggle"
							aria-expanded={openEntryId === entry.id}
							aria-label={`${openEntryId === entry.id ? 'Collapse' : 'Expand'} ${entry.courseCode}`}
							on:click={() => toggleEntry(entry.id)}
						>
							{openEntryId === entry.id ? '−' : '+'}
						</button>
						<div class="catalog-detail">
							<div>
								<h3>Assessment outline</h3>
								{#if assessmentsOf(entry).length}
									<dl>
										{#each assessmentsOf(entry) as assessment, index (`${entry.id}-a-${index}`)}
											<div>
												<dt>{assessment.title}</dt>
												<dd>{assessment.weight != null ? `${assessment.weight}%` : '-'}</dd>
											</div>
										{/each}
									</dl>
								{:else}
									<p>No assessments were shared for this section.</p>
								{/if}
							</div>
							<div>
								<h3>Book reference</h3>
								{#if booksOf(entry).length}
									{#each booksOf(entry) as book, index (`${entry.id}-b-${index}`)}
										<p>
											<strong>{book.title}</strong>
											{#if book.author}<br />{book.author}{/if}
											{#if book.isbn}<br /><span class="isbn">{book.isbn}</span>{/if}
											{#if book.required}<br />Required{/if}
										</p>
									{/each}
								{:else}
									<p>No book reference was shared for this section.</p>
								{/if}
							</div>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>
</div>
