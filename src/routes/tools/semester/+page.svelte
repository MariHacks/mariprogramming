<script>
	import { enhance } from '$app/forms';
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
	let extracting = false;
	let selectedFileName = '';

	let lastExtractionKey = '';

	/** @param {unknown} value */
	function textField(value) {
		return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
	}

	/**
	 * @param {Record<string, unknown> | null | undefined} source
	 */
	function applyIdentityFromProposals(source) {
		if (!source || typeof source !== 'object') return;
		const nextCode = textField(source.courseCode);
		const nextTitle = textField(source.title);
		const nextSection = textField(source.section);
		const nextTeacher = textField(source.teacherName ?? source.teacher);
		if (nextCode) courseCode = nextCode;
		if (nextTitle) title = nextTitle;
		if (nextSection) section = nextSection;
		if (nextTeacher) teacherName = nextTeacher;
	}

	$: if (form?.outlineFileName) selectedFileName = String(form.outlineFileName);
	$: extractionKey = String(form?.extraction?.sha256 ?? '');
	$: if (form?.extraction?.proposals && extractionKey !== lastExtractionKey) {
		lastExtractionKey = extractionKey;
		extracting = false;
		proposals = form.extraction.proposals;
		if (!proposals.assessments) proposals.assessments = [];
		if (!proposals.books) proposals.books = [];
		applyIdentityFromProposals(/** @type {Record<string, unknown>} */ (proposals));
	}
	$: if (form?.error) extracting = false;

	$: structuredJson = JSON.stringify({
		assessments: proposals.assessments ?? [],
		books: proposals.books ?? []
	});

	$: selectedTerm = $explicitTermId ?? ACADEMIC_TERMS[0]?.id ?? '';
	$: termName = ACADEMIC_TERMS.find((term) => term.id === selectedTerm)?.name ?? selectedTerm;
	$: missingDates = (proposals.assessments ?? []).filter((row) => {
		const title = String(row.title ?? '').trim();
		const date = String(row.date ?? '').trim();
		if (!title || date) return false;
		// Labs / quizzes / common-period finals often have no calendar day in the outline.
		if (/^(weekly\s+)?labs?$/i.test(title)) return false;
		if (/^quizzes?$/i.test(title)) return false;
		if (/second test|final exam|common evaluation/i.test(title)) return false;
		return /test|quiz|exam|project|midterm|assignment|paper|essay|presentation/i.test(title);
	}).length;
	$: identityFields = [
		{ label: 'Course code', value: courseCode },
		{ label: 'Title', value: title },
		{ label: 'Section', value: section },
		{ label: 'Teacher', value: teacherName }
	];
	$: identityFilled = identityFields.filter((field) => textField(field.value)).length;
	$: assessmentFilled = (proposals.assessments ?? []).filter((row) =>
		textField(row.title)
	).length;
	$: isReady = data.view.kind === 'ready';
	$: gateKind = data.view.kind;
	$: gateStack =
		gateKind === 'need-profile'
			? { status: 'Finish account to upload', action: 'Finish account to add an outline' }
			: gateKind === 'need-disclosure'
				? {
						status: 'Confirm disclosure to upload',
						action: 'Confirm disclosure to add an outline'
					}
				: { status: 'Sign in to upload', action: 'Sign in to add an outline' };

	function addAssessment() {
		proposals = {
			...proposals,
			assessments: [...(proposals.assessments ?? []), { title: '', weight: '', date: '' }]
		};
	}

	/** @param {number} index */
	function removeAssessment(index) {
		proposals = {
			...proposals,
			assessments: (proposals.assessments ?? []).filter((_, rowIndex) => rowIndex !== index)
		};
	}

	/** @param {Event} event */
	function onOutlineChosen(event) {
		const input = /** @type {HTMLInputElement} */ (event.currentTarget);
		const file = input.files?.[0] ?? null;
		selectedFileName = file?.name ?? '';
		if (!file) return;
		extracting = true;
		input.form?.requestSubmit();
	}

	function enhanceExtract() {
		return async ({ result, update }) => {
			extracting = true;
			await update({ reset: false });
			extracting = false;
			if (result.type === 'failure' || result.type === 'error') {
				selectedFileName = '';
			}
		};
	}
</script>

<svelte:head>
	<title>Semester | {MARITOOLS_NAME}</title>
	<meta
		name="description"
		content="Upload a course outline and check the dates before you share anything."
	/>
</svelte:head>

<div class="mt-preview">
	<section class="page page-semester">
		<div class="semester-layout">
			<aside class="course-stack">
				{#if isReady}
					<form
						method="POST"
						action="?/extract"
						enctype="multipart/form-data"
						class="stack-head"
						use:enhance={enhanceExtract}
					>
						<div>
							<strong>{termName}</strong>
							<span>{form?.extraction ? '1 course in review' : 'No outlines yet'}</span>
						</div>
						<label class="primary-button add-outline" class:is-busy={extracting}>
							{extracting
								? 'Extracting…'
								: selectedFileName
									? selectedFileName
									: 'Add outline PDF'}
							<input
								type="file"
								name="outline"
								accept="application/pdf"
								required
								aria-label="Add outline PDF"
								disabled={extracting}
								on:change={onOutlineChosen}
							/>
						</label>
					</form>
				{:else}
					<div class="stack-head">
						<div>
							<strong>{termName}</strong>
							<span>{gateStack.status}</span>
						</div>
						<a class="quiet-button add-outline--gate" href={resolve('/tools/account', {})}>
							{gateStack.action}
						</a>
					</div>
				{/if}

				{#if extracting}
					<button type="button" class="is-selected is-extracting" disabled>
						<span>Working</span>
						<strong>Reading outline</strong>
						<small>Extracting course identity and assessments…</small>
					</button>
				{:else if form?.extraction}
					<button type="button" class="is-selected" class:needs-dates={missingDates > 0}>
						<span>{courseCode || 'Course'}</span>
						<strong>{title || 'Untitled outline'}</strong>
						<small
							>{identityFilled}/4 identity · {missingDates
								? `${missingDates} date missing`
								: assessmentFilled
									? `${assessmentFilled} assessment${assessmentFilled === 1 ? '' : 's'}`
									: 'Ready to edit'}</small
						>
					</button>
				{:else if !isReady}
					<div class="stack-placeholder" aria-hidden="true">
						<span>PDF outline</span>
						<strong>Your courses appear here after upload</strong>
					</div>
				{/if}
			</aside>

			<div class="review-sheet">
				{#if gateKind === 'need-sign-in'}
					<div class="sheet-empty">
						<div class="sheet-head">
							<div>
								<span>Semester</span>
								<h2>Sign in to upload outlines</h2>
								<p>
									Course outlines stay private until you choose to share. Sign in with Google, then
									upload a text PDF to review dates and weights.
								</p>
							</div>
						</div>
						<a class="primary-button" href={resolve('/tools/account', {})}>Open account</a>
					</div>
				{:else if gateKind === 'need-profile'}
					<div class="sheet-empty">
						<div class="sheet-head">
							<div>
								<span>Semester</span>
								<h2>Finish your account</h2>
								<p>
									Add the remaining account details so we can save outlines privately to your
									profile.
								</p>
							</div>
						</div>
						<a class="primary-button" href={resolve('/tools/account', {})}>Open account</a>
					</div>
				{:else if gateKind === 'need-disclosure'}
					<div class="sheet-empty">
						<div class="sheet-head">
							<div>
								<span>Semester</span>
								<h2>Confirm the NVIDIA disclosure</h2>
								<p>
									Confirm the disclosure on your account page before outline text is sent for
									automatic analysis. You can still edit everything before sharing.
								</p>
							</div>
						</div>
						<a class="primary-button" href={resolve('/tools/account', {})}>Open account</a>
					</div>
				{:else if extracting}
					<div class="sheet-empty" role="status" aria-live="polite">
						<div class="sheet-head">
							<div>
								<span>Semester</span>
								<h2>Extracting outline</h2>
								<p>
									Reading {selectedFileName || 'your PDF'} and filling course identity plus
									assessments. Stay on this page.
								</p>
							</div>
						</div>
						<p class="sheet-hint">This can take up to a minute for a long outline.</p>
					</div>
				{:else if !form?.extraction}
					<div class="sheet-empty">
						<div class="sheet-head">
							<div>
								<span>Semester</span>
								<h2>Upload an outline</h2>
								<p>
									Choose a text PDF of a course outline. Check the dates and weights before you
									share anything. Scanned image PDFs will not work.
								</p>
							</div>
						</div>
						<p class="sheet-hint">
							Choose a course outline PDF. Extraction starts as soon as you pick the file.
						</p>
					</div>
				{/if}

				{#if form?.error}
					<p class="field-error" role="alert">{form.error}</p>
				{/if}

				{#if form?.extraction}
					{#if form.extraction.ok === false}
						<p role="status">
							{#if form.extraction.reason === 'missing-key'}
								Automatic extraction is unavailable. Type the assessments and books below. Your
								upload is saved privately.
							{:else}
								We could not extract this outline automatically. Type the fields below. Your upload
								is saved privately.
							{/if}
						</p>
					{/if}
					{#if form.extraction.cacheHit}
						<p role="status">Used a saved extraction for this file.</p>
					{/if}

					<form method="POST" action="?/contribute">
						<input type="hidden" name="sha256" value={form.extraction.sha256 ?? ''} />
						<input type="hidden" name="termId" value={selectedTerm} />
						<input type="hidden" name="structured" value={structuredJson} />

						<div class="sheet-head">
							<div>
								<span>Extraction review</span>
								<h2>{title || 'Untitled outline'}</h2>
								<p>Private unless you share. Sharing copies only the fields you confirm.</p>
							</div>
							<span class="course-ref"
								>{courseCode || 'Course code'}{section ? `, Sec. ${section}` : ''}</span
							>
						</div>

						<div class="review-fields">
							<label>
								<span>Course code</span>
								<input name="courseCode" bind:value={courseCode} required={contributeCatalog} />
							</label>
							<label>
								<span>Title</span>
								<input name="title" bind:value={title} required={contributeCatalog} />
							</label>
							<label>
								<span>Section</span>
								<input name="section" bind:value={section} required={contributeCatalog} />
							</label>
							<label>
								<span>Teacher</span>
								<input name="teacherName" bind:value={teacherName} required={contributeCatalog} />
							</label>
						</div>

						<div class="review-row header">
							<span>Assessment</span><span>Date</span><span>Weight</span><span></span>
						</div>
						{#each proposals.assessments ?? [] as assessment, index (index)}
							<div
								class="review-row"
								class:warned={!String(assessment.date ?? '').trim() &&
									String(assessment.title ?? '').trim()}
							>
								<input bind:value={assessment.title} aria-label="Assessment" />
								<input bind:value={assessment.date} aria-label="Date" placeholder="YYYY-MM-DD" />
								<input bind:value={assessment.weight} aria-label="Weight" />
								<button
									type="button"
									on:click={() => removeAssessment(index)}
									aria-label="Remove assessment">×</button
								>
							</div>
						{/each}
						{#if missingDates}
							<p class="field-error">Add a date for each named assessment before sharing.</p>
						{/if}
						<button class="add-row" type="button" on:click={addAssessment}>+ Add assessment</button>

						{#each proposals.books ?? [] as book, index (index)}
							<div class="review-row">
								<input bind:value={book.title} aria-label="Book title" placeholder="Book title" />
								<input bind:value={book.author} aria-label="Author" placeholder="Author" />
								<input bind:value={book.isbn} aria-label="ISBN" placeholder="ISBN" />
								<span></span>
							</div>
						{/each}

						<label class="share-band">
							<input type="checkbox" bind:checked={contributeCatalog} />
							<span>
								<strong>Share course facts with the catalog</strong>
								<small
									>Only the course code, instructor, assessments, and book references are
									shared.</small
								>
							</span>
						</label>
						<div class="sheet-actions">
							<span class:needs-attention={missingDates > 0 || identityFilled < 4}
								>{missingDates
									? `${missingDates} assessment date${missingDates === 1 ? '' : 's'} missing`
									: identityFilled < 4
										? `${identityFilled}/4 identity fields filled`
										: 'Private unless you share.'}</span
							>
							{#if contributeCatalog}
								<button type="submit" class="primary-button">Share to catalog</button>
							{/if}
						</div>
					</form>
				{/if}

				{#if form?.contributed}
					<p role="status">Saved to the catalog.</p>
				{/if}
			</div>
		</div>
	</section>
</div>
