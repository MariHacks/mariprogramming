<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { ACADEMIC_TERMS } from '$lib/maritools/term/calendar.js';
	import '$lib/maritools/styles/index-pages.css';

	export let data;

	/** @type {string | null} */
	let openEntryId = null;

	$: if (data.entries.length === 1) {
		openEntryId = data.entries[0]?.id ?? null;
	}

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
		return parts.length ? parts.join(', ') : 'No structured details yet';
	}
</script>

<svelte:head>
	<title>Course catalog | {MARITOOLS_NAME}</title>
	<meta
		name="description"
		content="Browse course facts students have shared, including books for a section."
	/>
</svelte:head>

<section class="mt-index-page catalog-page">
	<header class="mt-titlebar">
		<div>
			<h1>Course catalog</h1>
		</div>
		<p>Course facts students have shared, including books for a section. You can browse without an account.</p>
	</header>

	<form method="GET" class="mt-index-filters">
		<label class="mt-search-field">
			<span aria-hidden="true">⌕</span>
			<span>Search</span>
			<input name="q" value={data.query} aria-label="Search courses" placeholder="Course code, title, or teacher" />
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
		<div></div>
		<button type="submit" class="mt-dark-button">Search</button>
	</form>

	{#if data.unavailable}
		<p class="mt-error" role="alert">The catalog is unavailable right now. Try again.</p>
	{:else if data.entries.length === 0}
		<p class="mt-count-bar">No published catalog entries yet.</p>
	{:else}
		<div class="mt-count-bar">
			<strong>{data.entries.length} courses</strong>
			<span>Updated from reviewed student outlines</span>
		</div>
		<div class="mt-index-table">
			<div class="mt-index-head mt-catalog-row">
				<span>Code</span><span>Course</span><span>Section</span><span>Teacher</span><span>Term</span><span></span>
			</div>
			{#each data.entries as entry (entry.id)}
				<article class="mt-catalog-row" class:is-open={openEntryId === entry.id}>
					<strong class="mt-course-code">{entry.courseCode}</strong>
					<div>
						<h2>{entry.title}</h2>
						<p>{entrySummary(entry)}</p>
					</div>
					<span>sec.{entry.section}</span>
					<span>{entry.teacherName}</span>
					<span>{entry.termId}</span>
					<button
						type="button"
						class="mt-catalog-toggle"
						aria-expanded={openEntryId === entry.id}
						aria-label={`${openEntryId === entry.id ? 'Collapse' : 'Expand'} ${entry.courseCode}`}
						on:click={() => toggleEntry(entry.id)}
					>
						{openEntryId === entry.id ? '−' : '+'}
					</button>
					<div class="mt-catalog-detail">
						<div>
							<h3>Assessment outline</h3>
							{#if assessmentsOf(entry).length}
								<dl>
									{#each assessmentsOf(entry) as assessment, index (`${entry.id}-a-${index}`)}
										<div>
											<dt>{assessment.title}</dt>
											<dd>{assessment.weight != null ? `${assessment.weight}%` : '—'}</dd>
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
										{#if book.isbn}<br /><span>{book.isbn}</span>{/if}
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
