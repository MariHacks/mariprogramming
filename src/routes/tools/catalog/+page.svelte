<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { ACADEMIC_TERMS } from '$lib/maritools/term/calendar.js';

	export let data;

	function booksOf(entry) {
		return entry.structured?.books ?? [];
	}

	function assessmentsOf(entry) {
		return entry.structured?.assessments ?? [];
	}
</script>

<svelte:head>
	<title>Course catalog | {MARITOOLS_NAME}</title>
	<meta
		name="description"
		content="Browse course facts students have shared, including books for a section."
	/>
</svelte:head>

<section class="catalog-page page-container">
	<header class="intro">
		<h1>Course catalog</h1>
		<p>
			Course facts students have shared, including books for a section. You can browse without an
			account.
		</p>
	</header>

	<form method="GET" class="filters">
		<label>
			Term
			<select name="term">
				<option value="">All terms</option>
				{#each ACADEMIC_TERMS as term (term.id)}
					<option value={term.id} selected={term.id === data.termId}>{term.name}</option>
				{/each}
			</select>
		</label>
		<label>
			Course code
			<input name="q" value={data.query} class="code" />
		</label>
		<button type="submit" class="primary">Show courses</button>
	</form>

	{#if data.unavailable}
		<p class="error" role="alert">The catalog is unavailable right now. Try again.</p>
	{:else if data.entries.length === 0}
		<p>No published catalog entries yet.</p>
	{:else}
		<ul class="entries">
			{#each data.entries as entry (entry.id)}
				<li>
					<article>
						<h2>
							<span class="code">{entry.courseCode}</span>
							{entry.title}
						</h2>
						<p class="meta">
							{entry.termId} · sec.{entry.section} · {entry.teacherName}
						</p>
						{#if assessmentsOf(entry).length}
							<h3>Assessments</h3>
							<ul>
								{#each assessmentsOf(entry) as assessment, index (`${entry.id}-a-${index}`)}
									<li>
										{assessment.title}
										{#if assessment.weight} · {assessment.weight}%{/if}
										{#if assessment.date} · {assessment.date}{/if}
									</li>
								{/each}
							</ul>
						{/if}
						{#if booksOf(entry).length}
							<h3>Books</h3>
							<ul>
								{#each booksOf(entry) as book, index (`${entry.id}-b-${index}`)}
									<li>
										{book.title}{book.author ? `, ${book.author}` : ''}
										{#if book.required} · required{/if}
										{#if book.isbn}
											<span class="code"> {book.isbn}</span>
										{/if}
									</li>
								{/each}
							</ul>
						{/if}
					</article>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.catalog-page {
		display: grid;
		padding-block: var(--space-xl);
		gap: var(--space-md);
	}

	.intro h1 {
		font-family: var(--font-display);
		font-size: var(--text-3xl);
		line-height: 1.05;
	}

	.intro p {
		max-width: 52ch;
	}

	.filters {
		display: grid;
		grid-template-columns: minmax(0, 16rem) minmax(0, 16rem) auto;
		gap: var(--space-sm);
		align-items: end;
		border-block: var(--rule);
		padding-block: var(--space-sm);
	}

	label {
		display: grid;
		gap: var(--space-3xs);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	select,
	input {
		height: var(--control-height);
		padding-inline: var(--space-xs);
		border: var(--rule-strong);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		font: inherit;
	}

	.code {
		font-family: var(--font-mono);
	}

	.primary {
		height: var(--control-height);
		padding-inline: var(--space-md);
		border: 0;
		border-radius: var(--radius-sm);
		background: var(--club-blue);
		color: #fff;
		font-weight: 650;
	}

	.primary:focus-visible,
	select:focus-visible,
	input:focus-visible {
		outline: var(--focus-ring-width) solid var(--club-blue);
		outline-offset: var(--focus-ring-offset);
	}

	.entries {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.entries li + li {
		border-block-start: var(--rule);
	}

	article {
		display: grid;
		gap: var(--space-xs);
		padding-block: var(--space-md);
	}

	h2 {
		font-size: var(--text-lg);
	}

	h3 {
		font-size: var(--text-sm);
		font-weight: 700;
	}

	.meta,
	.error {
		font-size: var(--text-sm);
	}

	.meta {
		color: var(--quiet-steel);
	}

	.error {
		color: var(--danger);
	}

	@media (max-width: 40rem) {
		.filters {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
