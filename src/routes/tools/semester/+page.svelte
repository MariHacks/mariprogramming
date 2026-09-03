<script>
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';

	/** @type {any} */
	export let data;
	/** @type {any} */
	export let form = null;

	const EMPTY_PROPOSALS = {
		assessments: [{ title: '', weight: '', weightLabel: '', date: '', dateIso: null }],
		books: [{ title: '', author: '', isbn: '', required: false }]
	};
	let proposals = EMPTY_PROPOSALS;
	let courseCode = '';
	let title = '';
	let section = '';
	let teacherName = '';
	let editing = false;
	let selectedFileName = '';
	/** @type {HTMLInputElement | null} */
	let outlinePicker = null;
	/** @type {Array<{ id: number, name: string, status: 'processing' | 'error', error?: string }>} */
	let pendingUploads = [];
	/** @type {number | null} */
	let selectedPendingId = null;
	let uploadId = 0;

	let lastExtractionKey = '';
	let selectedSha = '';
	let latestFormSha = '';
	/** @type {any[]} */
	let savedOutlines = [];
	/** @type {any} */
	let selectedOutline = null;
	/** @type {{ id: number, name: string, status: 'processing' | 'error', error?: string } | null} */
	let selectedPending = null;
	$: savedOutlines = Array.isArray(data?.outlines) ? data.outlines : [];
	$: selectedPending = pendingUploads.find((upload) => upload.id === selectedPendingId) ?? null;
	$: formSha = String(form?.extraction?.sha256 ?? '');
	$: if (formSha && formSha !== latestFormSha) {
		latestFormSha = formSha;
		selectedSha = formSha;
	}
	$: if (!selectedSha && savedOutlines.length) selectedSha = String(savedOutlines[0].sha256);
	$: selectedOutline = savedOutlines.find((/** @type {any} */ outline) => outline.sha256 === selectedSha) ?? null;
	$: savedExtraction = selectedOutline?.extraction
		? { ok: true, reason: null, sha256: selectedOutline.sha256, ...selectedOutline.extraction }
		: null;
	$: activeExtraction = formSha && selectedSha === formSha ? form.extraction : savedExtraction;
	$: selectedIsProcessing = Boolean(selectedOutline && !selectedOutline.extraction);
	$: selectedIsSaved = Boolean(selectedOutline?.extraction);
	$: fieldsDisabled = selectedIsSaved && !editing;

	onMount(() => {
		const timer = setInterval(() => {
			if (savedOutlines.some((/** @type {any} */ outline) => !outline.extraction)) void invalidateAll();
		}, 2000);
		return () => clearInterval(timer);
	});

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
	$: extractionKey = String(activeExtraction?.sha256 ?? '');
	$: if (activeExtraction?.proposals && extractionKey !== lastExtractionKey) {
		lastExtractionKey = extractionKey;
		const next = activeExtraction.proposals;
		proposals = {
			...next,
			assessments: (next.assessments ?? []).map((/** @type {any} */ row) => ({
				...row,
				weightLabel:
					textField(row.weightLabel) ||
					(row.weight === null || row.weight === undefined || row.weight === ''
						? ''
						: `${row.weight}%`)
			})),
			books: next.books ?? []
		};
		applyIdentityFromProposals(/** @type {Record<string, unknown>} */ (proposals));
		if (formSha && extractionKey === formSha) editing = true;
	}

	/** @param {string} sha256 */
	function selectOutline(sha256) {
		selectedPendingId = null;
		selectedSha = sha256;
		editing = false;
		lastExtractionKey = '';
	}

	/** @param {number} id */
	function selectPendingUpload(id) {
		selectedPendingId = id;
		editing = false;
	}

	$: structuredJson = JSON.stringify({
		assessments: proposals.assessments ?? [],
		books: proposals.books ?? []
	});

	$: termName = String(data?.activeTerm?.name ?? 'Current term');
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
	$: assessmentFilled = (proposals.assessments ?? []).filter((row) => textField(row.title)).length;
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
		if (fieldsDisabled) return;
		proposals = {
			...proposals,
			assessments: [
				...(proposals.assessments ?? []),
				{ title: '', weight: '', weightLabel: '', date: '', dateIso: null }
			]
		};
	}

	/** @param {number} index */
	function removeAssessment(index) {
		if (fieldsDisabled) return;
		proposals = {
			...proposals,
			assessments: (proposals.assessments ?? []).filter((_, rowIndex) => rowIndex !== index)
		};
	}

	/** @param {number} id @param {Partial<{ status: 'processing' | 'error', error: string }>} update */
	function updateUpload(id, update) {
		pendingUploads = pendingUploads.map((upload) =>
			upload.id === id ? { ...upload, ...update } : upload
		);
	}

	/** @param {File} file @param {number} id */
	async function processOutline(file, id) {
		const body = new FormData();
		body.append('outline', file);
		try {
			const response = await fetch('?/extract', { method: 'POST', body });
			const result = deserialize(await response.text());
			const resultData = 'data' in result ? result.data : undefined;
			const extraction = /** @type {any} */ (resultData)?.extraction;
			if (result.type === 'success' && extraction) {
				selectedFileName = file.name;
				selectedSha = String(extraction.sha256 ?? '');
				pendingUploads = pendingUploads.filter((upload) => upload.id !== id);
				if (selectedPendingId === id) selectedPendingId = null;
				await invalidateAll();
				return;
			}
			updateUpload(id, {
				status: 'error',
				error: String((/** @type {any} */ (resultData))?.error ?? 'Could not process this PDF.')
			});
		} catch {
			updateUpload(id, { status: 'error', error: 'Could not process this PDF.' });
		}
	}

	/** @param {Event} event */
	function onOutlineChosen(event) {
		const input = /** @type {HTMLInputElement} */ (event.currentTarget);
		const files = Array.from(input.files ?? []);
		input.value = '';
		for (const file of files) {
			const id = (uploadId += 1);
			pendingUploads = [...pendingUploads, { id, name: file.name, status: 'processing' }];
			void processOutline(file, id);
		}
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
						id="semester-outline-upload"
						method="POST"
						action="?/extract"
						enctype="multipart/form-data"
						class="stack-head"
					>
						<div>
							<strong>{termName}</strong>
							<span
								>{savedOutlines.length || activeExtraction
									? `${Math.max(savedOutlines.length, 1)} course${Math.max(savedOutlines.length, 1) === 1 ? '' : 's'} saved`
									: 'No outlines yet'}</span
							>
						</div>
						<input
							bind:this={outlinePicker}
							type="file"
							name="outline"
							form="semester-outline-upload"
							accept="application/pdf"
							multiple
							hidden
							aria-label="Choose outline PDFs"
							class="visually-hidden"
							on:change={onOutlineChosen}
						/>
						<button
							type="button"
							class="primary-button add-outline"
							on:click={() => outlinePicker?.click()}
						>
							Add outline PDF
						</button>
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

				{#each pendingUploads as upload (upload.id)}
					<div role="status">
						<button
							type="button"
							class="is-extracting pending-upload"
							class:is-selected={selectedPendingId === upload.id}
							class:needs-dates={upload.status === 'error'}
							on:click={() => selectPendingUpload(upload.id)}
						>
							<span>{upload.status === 'error' ? 'Needs attention' : 'Working'}</span>
							<strong>{upload.name}</strong>
							<small>{upload.error ?? 'Processing outline'}</small>
						</button>
					</div>
				{/each}
				{#each savedOutlines as outline (outline.sha256)}
					{#if outline.extraction}
						<button
							type="button"
							class:is-selected={!selectedPending && selectedSha === outline.sha256}
							on:click={() => selectOutline(outline.sha256)}
						>
							<span>{textField(outline.extraction.proposals?.courseCode) || 'Course'}</span>
							<strong>{textField(outline.extraction.proposals?.title) || 'Untitled outline'}</strong>
							<small>Saved to your account</small>
						</button>
					{:else}
						<button
							type="button"
							class="is-extracting"
							class:is-selected={!selectedPending && selectedSha === outline.sha256}
							on:click={() => selectOutline(outline.sha256)}
						>
							<span>Working</span>
							<strong>Processing PDF</strong>
							<small>Saved to your account while extraction finishes</small>
						</button>
					{/if}
				{/each}
				{#if formSha && activeExtraction && !savedOutlines.some((/** @type {any} */ outline) => outline.sha256 === formSha)}
					<button type="button" class="is-selected" class:needs-dates={missingDates > 0}>
						<span>{courseCode || 'Course'}</span>
						<strong>{title || 'Untitled outline'}</strong>
						<small
							>{identityFilled}/4 identity, {missingDates
								? `${missingDates} date missing`
								: assessmentFilled
									? `${assessmentFilled} assessment${assessmentFilled === 1 ? '' : 's'}`
									: 'Ready to edit'}</small
						>
					</button>
				{/if}
				{#if !isReady}
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
				{:else if selectedPending || selectedIsProcessing}
					<div
						class="processing-state"
						role="status"
						aria-live="polite"
						aria-busy={selectedPending?.status !== 'error'}
					>
						<div class="outline-loader" aria-hidden="true">
							<span class="outline-loader__label">PDF</span>
							<span class="outline-loader__rules">
								<span></span>
								<span></span>
								<span></span>
								<span></span>
							</span>
							<span class="outline-loader__progress"><span></span></span>
						</div>
						<div class="processing-copy">
							<h2>{selectedPending?.status === 'error' ? 'Could not process this outline' : 'Extracting your outline'}</h2>
							<p>{selectedPending?.name || selectedFileName || 'Course outline PDF'}</p>
							<small
								>{selectedPending?.error ??
									'Your editable review will appear when the full outline is ready.'}</small
							>
						</div>
					</div>
				{:else if !activeExtraction}
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

				{#if activeExtraction && !selectedPending}
					{#if activeExtraction.ok === false}
						<p role="status">
							{#if activeExtraction.reason === 'missing-key'}
								Automatic extraction is unavailable. Type the assessments and books below. Your
								upload is saved privately.
							{:else}
								We could not extract this outline automatically. Type the fields below. Your upload
								is saved privately.
							{/if}
						</p>
					{/if}
					{#if activeExtraction.cacheHit}
						<p role="status">Used a saved extraction for this file.</p>
					{/if}

					<form method="POST" action="?/contribute">
						<input type="hidden" name="sha256" value={activeExtraction.sha256 ?? ''} />
						<input type="hidden" name="structured" value={structuredJson} />

						<div class="sheet-head review-heading">
							<div>
								<span>Outline review</span>
								<h2>Review extracted details</h2>
								<p>{fieldsDisabled ? 'Saved privately to your account.' : 'Review carefully. Saving shares these course facts.'}</p>
							</div>
							<div class="review-course-ref">
								<strong>{title || 'Untitled outline'}</strong>
								<span class="course-ref"
									>{courseCode || 'Course code'}{section ? `, Sec. ${section}` : ''}</span
								>
							</div>
						</div>

						<section class="review-section" aria-labelledby="course-details-heading">
							<div class="review-section__head">
								<h3 id="course-details-heading">Course details</h3>
								<span>{identityFilled} of 4 complete</span>
							</div>
							<div class="review-fields">
								<label>
									<span>Course code</span>
									<input name="courseCode" bind:value={courseCode} required disabled={fieldsDisabled} />
								</label>
								<label>
									<span>Title</span>
									<input name="title" bind:value={title} required disabled={fieldsDisabled} />
								</label>
								<label>
									<span>Section</span>
									<input name="section" bind:value={section} required disabled={fieldsDisabled} />
								</label>
								<label>
									<span>Teacher</span>
									<input name="teacherName" bind:value={teacherName} required disabled={fieldsDisabled} />
								</label>
							</div>
						</section>

						<section class="review-section" aria-labelledby="assessments-heading">
							<div class="review-section__head">
								<h3 id="assessments-heading">Assessments</h3>
								<span>{assessmentFilled} extracted</span>
							</div>
							<div class="review-table" role="group" aria-label="Editable assessments">
								<div class="review-row header">
									<span>Assessment</span><span>Due</span><span>Weight options</span><span></span>
								</div>
								{#each proposals.assessments ?? [] as assessment, index (index)}
									<div
										class="review-row"
										class:warned={!String(assessment.date ?? '').trim() &&
											String(assessment.title ?? '').trim()}
									>
										<input bind:value={assessment.title} aria-label="Assessment" disabled={fieldsDisabled} />
										<input
											bind:value={assessment.date}
											aria-label="Date"
											placeholder="Date or schedule"
											disabled={fieldsDisabled}
										/>
										<input bind:value={assessment.weightLabel} aria-label="Weight" disabled={fieldsDisabled} />
										<button
											type="button"
											disabled={fieldsDisabled}
											on:click={() => removeAssessment(index)}
											aria-label="Remove assessment">×</button
										>
									</div>
								{/each}
							</div>
							{#if missingDates}
								<p class="field-error">Add a date for each named assessment before sharing.</p>
							{/if}
							<button class="add-row" type="button" disabled={fieldsDisabled} on:click={addAssessment}
								>+ Add assessment</button
							>
						</section>

						<section class="review-section" aria-labelledby="books-heading">
							<div class="review-section__head">
								<h3 id="books-heading">Books</h3>
								<span>{(proposals.books ?? []).length} extracted</span>
							</div>
							<div class="review-table books-table" role="group" aria-label="Editable books">
								<div class="review-row header">
									<span>Title</span><span>Author</span><span>ISBN</span><span></span>
								</div>
								{#each proposals.books ?? [] as book, index (index)}
									<div class="review-row">
										<input
											bind:value={book.title}
											aria-label="Book title"
											placeholder="Book title"
											disabled={fieldsDisabled}
										/>
										<input bind:value={book.author} aria-label="Author" placeholder="Author" disabled={fieldsDisabled} />
										<input bind:value={book.isbn} aria-label="ISBN" placeholder="ISBN" disabled={fieldsDisabled} />
										<span></span>
									</div>
								{/each}
							</div>
						</section>

						<div class="sheet-actions">
							<span class:needs-attention={missingDates > 0 || identityFilled < 4}
								>{missingDates
									? `${missingDates} assessment date${missingDates === 1 ? '' : 's'} missing`
									: identityFilled < 4
										? `${identityFilled}/4 identity fields filled`
										: fieldsDisabled ? 'Saved privately.' : 'Save shares these facts to the catalog.'}</span
							>
							<div class="course-actions">
								<button type="submit" class="danger-button" formaction="?/deleteOutline" formnovalidate>Delete</button>
								{#if fieldsDisabled}
									<button type="button" class="quiet-button" on:click={() => (editing = true)}>Edit</button>
								{:else}
									<button type="submit" class="primary-button">Save</button>
								{/if}
							</div>
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
