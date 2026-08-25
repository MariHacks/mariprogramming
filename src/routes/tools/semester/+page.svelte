<script>
	import { resolve } from '$app/paths';
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import { ACADEMIC_TERMS } from '$lib/maritools/term/calendar.js';
	import { explicitTermId } from '$lib/maritools/term/session.js';

	export let data;
	export let form = null;

	let proposals = form?.extraction?.proposals ?? {
		assessments: [{ title: '', weight: '', date: '' }],
		books: [{ title: '', author: '', isbn: '', required: false }]
	};
	let courseCode = '';
	let title = '';
	let section = '';
	let teacherName = '';
	let contributeCatalog = false;

	$: if (form?.extraction?.proposals) {
		proposals = form.extraction.proposals;
		if (!proposals.assessments) proposals.assessments = [];
		if (!proposals.books) proposals.books = [];
	}

	$: structuredJson = JSON.stringify({
		assessments: proposals.assessments ?? [],
		books: proposals.books ?? []
	});

	$: selectedTerm = $explicitTermId ?? ACADEMIC_TERMS[0]?.id ?? '';
</script>

<svelte:head>
	<title>Semester | {MARITOOLS_NAME}</title>
	<meta
		name="description"
		content="Upload a course outline, review dates and weights, and keep what you confirm."
	/>
</svelte:head>

<section class="semester-page page-container">
	<header class="intro">
		<h1>Semester</h1>
		<p>
			Upload a text PDF of a course outline. Check the dates and weights before anything is shared.
			Scanned image PDFs will not work.
		</p>
	</header>

	{#if data.view.kind === 'need-sign-in'}
		<p>
			<a href={resolve('/tools/account', {})}>Sign in</a> and finish your account before uploading an
			outline.
		</p>
	{:else if data.view.kind === 'need-profile'}
		<p>
			<a href={resolve('/tools/account', {})}>Finish your account</a> so we can save outlines privately.
		</p>
	{:else if data.view.kind === 'need-disclosure'}
		<p>
			<a href={resolve('/tools/account', {})}>Confirm the NVIDIA disclosure</a> on your account page
			before we send outline text for analysis.
		</p>
	{:else}
		<form method="POST" action="?/extract" enctype="multipart/form-data" class="upload">
			<label>
				Course outline PDF
				<input type="file" name="outline" accept="application/pdf" required />
			</label>
			<button type="submit" class="primary">Read outline</button>
		</form>
	{/if}

	{#if form?.error}
		<p class="error" role="alert">{form.error}</p>
	{/if}

	{#if form?.extraction}
		{#if form.extraction.ok === false}
			<p class="status" role="status">
				{#if form.extraction.reason === 'missing-key'}
					Automatic extraction is unavailable. Type the assessments and books below. Your upload is
					saved privately.
				{:else}
					We could not extract this outline automatically. Type the fields below. Your upload is
					saved privately.
				{/if}
			</p>
		{/if}
		{#if form.extraction.cacheHit}
			<p class="status" role="status">Reused a saved extraction for this file.</p>
		{/if}

		<form method="POST" action="?/contribute" class="review">
			<input type="hidden" name="sha256" value={form.extraction.sha256 ?? ''} />
			<input type="hidden" name="termId" value={selectedTerm} />
			<input type="hidden" name="structured" value={structuredJson} />

			<label>
				Course code
				<input name="courseCode" bind:value={courseCode} class="code" required={contributeCatalog} />
			</label>
			<label>
				Title
				<input name="title" bind:value={title} required={contributeCatalog} />
			</label>
			<label>
				Section
				<input name="section" bind:value={section} required={contributeCatalog} />
			</label>
			<label>
				Teacher
				<input name="teacherName" bind:value={teacherName} required={contributeCatalog} />
			</label>

			<h2>Assessments</h2>
			{#each proposals.assessments ?? [] as assessment, index (index)}
				<div class="row">
					<label>
						Title
						<input bind:value={assessment.title} />
					</label>
					<label>
						Weight
						<input bind:value={assessment.weight} />
					</label>
					<label>
						Date
						<input bind:value={assessment.date} placeholder="YYYY-MM-DD" />
					</label>
				</div>
			{/each}

			<h2>Books</h2>
			{#each proposals.books ?? [] as book, index (index)}
				<div class="row">
					<label>
						Title
						<input bind:value={book.title} />
					</label>
					<label>
						Author
						<input bind:value={book.author} />
					</label>
					<label>
						ISBN
						<input bind:value={book.isbn} class="code" />
					</label>
					<label class="disclose">
						<input type="checkbox" bind:checked={book.required} />
						Required
					</label>
				</div>
			{/each}

			<p>
				Private use is the default. Your PDF stays off the catalog. Sharing copies only the
				structured fields you confirm.
			</p>
			<label class="disclose">
				<input type="checkbox" bind:checked={contributeCatalog} />
				Share these fields to the course catalog
			</label>
			{#if contributeCatalog}
				<button type="submit" class="primary">Share to catalog</button>
			{/if}
		</form>
	{/if}

	{#if form?.contributed}
		<p class="status" role="status">Saved to the catalog.</p>
	{/if}
</section>

<style>
	.semester-page {
		display: grid;
		padding-block: var(--space-xl);
		gap: var(--space-md);
		max-width: 46rem;
	}

	.intro h1 {
		font-family: var(--font-display);
		font-size: var(--text-3xl);
		line-height: 1.05;
	}

	.intro p,
	p {
		max-width: 52ch;
	}

	.upload,
	.review,
	.row {
		display: grid;
		gap: var(--space-sm);
	}

	.review {
		border-block-start: var(--rule);
		padding-block-start: var(--space-md);
	}

	.row {
		padding-block: var(--space-sm);
		border-block-start: var(--rule);
	}

	label {
		display: grid;
		gap: var(--space-3xs);
		font-size: var(--text-sm);
		font-weight: 600;
	}

	.disclose {
		grid-template-columns: auto 1fr;
		align-items: start;
		font-weight: 400;
	}

	input:not([type='checkbox']):not([type='file']) {
		height: var(--control-height);
		padding-inline: var(--space-xs);
		border: var(--rule);
		border-radius: var(--radius-sm);
		font: inherit;
	}

	.code {
		font-family: var(--font-mono);
	}

	.primary {
		justify-self: start;
		height: var(--control-height);
		padding-inline: var(--space-md);
		border: 0;
		border-radius: var(--radius-sm);
		background: var(--club-blue);
		color: #fff;
		font-weight: 650;
	}

	.primary:focus-visible {
		outline: var(--focus-ring-width) solid var(--club-blue);
		outline-offset: var(--focus-ring-offset);
	}

	.error {
		color: var(--danger);
	}

	.status {
		color: var(--quiet-steel);
		font-size: var(--text-sm);
	}

	h2 {
		font-size: var(--text-sm);
		font-weight: 700;
		margin-top: var(--space-sm);
	}
</style>
