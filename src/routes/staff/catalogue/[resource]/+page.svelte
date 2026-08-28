<script>
	import { afterUpdate, tick } from 'svelte';
	import { applyAction, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';

	/** @type {any} */
	export let data;
	/** @type {any} */
	export let form = null;

	const resources = Object.freeze([
		['entries', 'Entries'],
		['teachers', 'Teachers'],
		['courses', 'Courses'],
		['bookstores', 'Bookstores'],
		['books', 'Books'],
		['assignments', 'Assignments']
	]);
	const labels = /** @type {Readonly<Record<string, { singular: string, plural: string }>>} */ (
		Object.freeze({
			entries: { singular: 'catalogue entry', plural: 'Catalogue entries' },
			teachers: { singular: 'teacher', plural: 'Teachers' },
			courses: { singular: 'course', plural: 'Courses' },
			bookstores: { singular: 'bookstore', plural: 'Bookstores' },
			books: { singular: 'book', plural: 'Books' },
			assignments: { singular: 'assignment', plural: 'Assignments' }
		})
	);
	const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
	const MUTATION_ACTIONS = new Set(['create', 'update', 'activate', 'deactivate', 'importSource']);
	const ENTRY_FIELDS = Object.freeze([
		Object.freeze({ name: 'courseCode', label: 'Course code', required: true, maxlength: 64 }),
		Object.freeze({ name: 'section', label: 'Section', required: false, maxlength: 80 }),
		Object.freeze({ name: 'title', label: 'Course title', required: true, maxlength: 200 }),
		Object.freeze({ name: 'instructor', label: 'Instructor', required: true, maxlength: 160 }),
		Object.freeze({ name: 'author', label: 'Author', required: false, maxlength: 200 }),
		Object.freeze({ name: 'bookTitle', label: 'Book title', required: true, maxlength: 240 }),
		Object.freeze({ name: 'edition', label: 'Edition', required: false, maxlength: 240 }),
		Object.freeze({ name: 'isbn', label: 'ISBN', required: false, maxlength: 32 }),
		Object.freeze({ name: 'bookstore', label: 'Bookstore', required: false, maxlength: 160 }),
		Object.freeze({
			name: 'notes',
			label: 'Notes',
			required: false,
			maxlength: 500,
			textarea: true
		}),
		Object.freeze({
			name: 'sourceDate',
			label: 'Source date',
			required: false,
			maxlength: 10,
			type: 'date'
		})
	]);

	/** @type {HTMLDivElement | undefined} */
	let errorSummaryElement;
	/** @type {any} */
	let focusedForm = null;
	/** @type {any} */
	let enhancedForm = null;
	let submitting = false;

	$: resourceLabel = labels[data.resource];
	$: responseForm = enhancedForm ?? form;
	$: editorValues = responseForm?.values ?? {};
	$: editorAction = data.mode === 'add' ? 'create' : 'update';
	$: failureContext = failureContextFor(responseForm?.action, responseForm?.selectedId);
	$: snapshotPreview = data.resource === 'entries' && data.records.length === 0;
	$: displayedRecords = snapshotPreview ? (data.sourceEntries ?? []) : data.records;

	afterUpdate(() => {
		if (responseForm?.errorSummary && responseForm !== focusedForm) {
			focusedForm = responseForm;
			errorSummaryElement?.focus();
		} else if (!responseForm?.errorSummary) {
			focusedForm = null;
		}
	});

	/** @param {Record<string, string | number | null | undefined>} [parameters] */
	function querySuffix(parameters = {}) {
		const query = new URLSearchParams();
		if (data.search) query.set('q', data.search);
		for (const [key, value] of Object.entries(parameters)) {
			if (value !== null && value !== undefined) query.set(key, String(value));
		}
		const suffix = query.toString();
		return suffix ? `?${suffix}` : '';
	}

	/** @param {any} record */
	function recordName(record) {
		if (data.resource === 'teachers') return record.name;
		if (data.resource === 'courses') return `${record.code} ${record.title}`;
		if (data.resource === 'bookstores') return record.name;
		if (data.resource === 'books') return record.title;
		if (data.resource === 'entries') {
			return `${record.courseCode} ${record.section}: ${record.bookTitle}`;
		}
		return `${record.courseCode}: ${record.bookTitle}`;
	}

	/** @param {unknown} action @param {unknown} selectedId */
	function failureContextFor(action, selectedId) {
		const record =
			typeof selectedId === 'string'
				? data.records.find((/** @type {any} */ candidate) => candidate.id === selectedId)
				: null;
		const target = record ? recordName(record) : `this ${resourceLabel.singular}`;
		if (action === 'create') return `Could not add ${resourceLabel.singular}.`;
		if (action === 'update') return `Could not save ${target}.`;
		if (action === 'activate') return `Could not activate ${target}.`;
		if (action === 'deactivate') return `Could not deactivate ${target}.`;
		if (action === 'importSource') return 'Could not load the teacher list.';
		return 'Changes were not saved.';
	}

	/** @param {number} cents */
	function money(cents) {
		return (cents / 100).toFixed(2);
	}

	/** @param {string} field @param {string | number} [fallback] */
	function selectedValue(field, fallback = '') {
		if (Object.prototype.hasOwnProperty.call(editorValues, field)) return editorValues[field];
		const selected = data.selected;
		if (!selected) return fallback;
		if (field === 'serviceFee') return money(selected.serviceFeeCents);
		if (field === 'price') return selected.priceCents == null ? '' : money(selected.priceCents);
		return selected[field] ?? fallback;
	}

	/** @param {string} field */
	function fieldError(field) {
		return responseForm?.fieldErrors?.[field] ?? '';
	}

	/** @param {any} record @param {string} resource */
	function optionLabel(record, resource) {
		let text;
		if (resource === 'teachers') text = record.name;
		else if (resource === 'bookstores') text = record.name;
		else if (resource === 'courses') text = `${record.code}, ${record.title}`;
		else text = `${record.title}, ${record.bookstoreName}`;
		return record.effectiveActive ? text : `${text} (inactive)`;
	}

	/** @param {any} record */
	function blockedText(record) {
		if (!record.blockedBy?.length) return '';
		return `Blocked by inactive ${record.blockedBy.join(', ')}`;
	}

	/** @param {FormData} formData */
	function selectedRecordId(formData) {
		const entries = formData.getAll('id');
		if (entries.length !== 1 || typeof entries[0] !== 'string' || !UUID_PATTERN.test(entries[0])) {
			return undefined;
		}
		return data.records.some((/** @type {any} */ record) => record.id === entries[0])
			? entries[0]
			: undefined;
	}

	/** @param {HTMLFormElement} formElement @param {HTMLElement | null} submitter */
	function submittedAction(formElement, submitter) {
		const submitterAction = submitter?.getAttribute('formaction')?.match(/^\?\/(\w+)$/u)?.[1];
		const action = submitterAction ?? formElement.dataset.action;
		return action && MUTATION_ACTIONS.has(action) ? action : undefined;
	}

	/** @param {unknown} value @param {string} action @param {string | undefined} selectedId */
	function boundedFailure(value, action, selectedId) {
		const source = value && typeof value === 'object' ? /** @type {any} */ (value) : {};
		const errorSummary =
			typeof source.errorSummary === 'string' &&
			source.errorSummary.length > 0 &&
			source.errorSummary.length <= 240
				? source.errorSummary
				: 'The request could not be completed. Try again.';
		return {
			action,
			errorSummary,
			fieldErrors:
				source.fieldErrors && typeof source.fieldErrors === 'object' ? source.fieldErrors : {},
			values: source.values && typeof source.values === 'object' ? source.values : {},
			...(selectedId ? { selectedId } : {})
		};
	}

	/** @param {unknown} value @param {string | undefined} selectedId */
	function boundedSuccess(value, selectedId) {
		const source = value && typeof value === 'object' ? /** @type {any} */ (value) : {};
		const message =
			typeof source.message === 'string' &&
			source.message.length > 0 &&
			source.message.length <= 160
				? source.message
				: 'Changes saved.';
		return { success: true, message, ...(selectedId ? { selectedId } : {}) };
	}

	/** @type {import('@sveltejs/kit').SubmitFunction} */
	function enhanceMutation({ formData, formElement, submitter, cancel }) {
		const action = submittedAction(formElement, submitter);
		if (!action) {
			cancel();
			return;
		}
		const selectedId = selectedRecordId(formData);
		enhancedForm = null;
		submitting = true;

		return async ({ result }) => {
			try {
				if (result.type === 'failure') {
					const data = boundedFailure(result.data, action, selectedId);
					enhancedForm = data;
					await applyAction({ ...result, data });
				} else if (result.type === 'success') {
					const data = boundedSuccess(result.data, selectedId);
					enhancedForm = data;
					try {
						await applyAction({ ...result, data });
						await invalidateAll();
					} catch {
						// The server has already committed the mutation. Keep its bounded success state.
					}
				} else if (result.type === 'redirect') {
					await applyAction(result);
				} else {
					enhancedForm = boundedFailure(null, action, selectedId);
				}
			} catch {
				enhancedForm = boundedFailure(null, action, selectedId);
			} finally {
				submitting = false;
				await tick();
				if (enhancedForm?.errorSummary) errorSummaryElement?.focus();
			}
		};
	}
</script>

<svelte:head>
	<title>{resourceLabel.plural} | Programming Club Staff</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="catalogue-page">
	<header class="catalogue-heading">
		<h1>Catalogue</h1>
		{#if responseForm?.success}<p class="action-message" role="status">
				{responseForm.message}
			</p>{/if}
		{#if submitting}<p class="action-message" role="status">Saving changes</p>{/if}
	</header>

	{#if responseForm?.errorSummary}
		<div
			class="error-summary"
			role="alert"
			aria-live="assertive"
			aria-atomic="true"
			tabindex="-1"
			bind:this={errorSummaryElement}
		>
			<strong>{failureContext}</strong>
			<span>{responseForm.errorSummary}</span>
		</div>
	{/if}

	<nav class="resource-nav" aria-label="Catalogue resources">
		{#each resources as [slug, label] (slug)}
			<a
				href={resolve('/staff/catalogue/[resource]', { resource: slug })}
				aria-current={data.resource === slug ? 'page' : undefined}>{label}</a
			>
		{/each}
	</nav>

	{#if data.resource === 'entries' && !data.unavailable}
		<section class="source-panel" aria-label="Mios teacher list">
			<p>
				Source of truth: teacher {data.source?.teacher ?? 'Mios'}, {data.source?.date ??
					'2026-08-20'}, last updated {data.source?.updatedAtLabel ?? '19:09 America/Toronto'}.
				Contact
				<a href="mailto:team@marihacks.com">{data.contact?.email ?? 'team@marihacks.com'}</a>
				· {data.contact?.instagram ?? '@marihacks'}.
			</p>
			{#if data.notices?.length}
				<ul class="notice-list">
					{#each data.notices as notice (notice)}
						<li>{notice}</li>
					{/each}
				</ul>
			{/if}
			{#if snapshotPreview}
				<form method="post" data-action="importSource" use:enhance={enhanceMutation}>
					<input type="hidden" name="intent" value="mios-2026-08-20" />
					<button
						class="primary-action"
						type="submit"
						formaction="?/importSource"
						disabled={submitting}>Load Mios teacher list</button
					>
				</form>
			{/if}
		</section>
	{/if}

	<div class:with-editor={data.mode && !data.unavailable} class="catalogue-grid">
		<section class="catalogue-list" aria-labelledby="resource-title">
			<header class="list-heading">
				<div>
					<h2 id="resource-title">{resourceLabel.plural}</h2>
					<p aria-live="polite">
						{data.records.length}
						{data.records.length === 1 ? 'result' : 'results'}
						{#if data.search && data.records.length !== data.totalCount}
							<span>from {data.totalCount} total</span>
						{/if}
					</p>
				</div>
				{#if !data.unavailable}
					<!-- Query state is appended to a route already resolved with SvelteKit. -->
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						class="add-link"
						href={`${resolve('/staff/catalogue/[resource]', { resource: data.resource })}${querySuffix({ add: 1 })}`}
						>Add {resourceLabel.singular}</a
					>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{/if}
			</header>

			<form class="search-form" method="get" role="search">
				<label for="catalogue-search">Search {data.resource}</label>
				<div>
					<input
						id="catalogue-search"
						type="search"
						name="q"
						value={data.search}
						maxlength="100"
						autocomplete="off"
					/>
					<button type="submit">Search</button>
				</div>
			</form>

			{#if data.unavailable}
				<p class="notice error-notice" role="alert">
					Catalogue data is unavailable.
					<a class="inline-action" href={resolve('/staff/catalogue/[resource]', { resource: data.resource })}
						>Reload catalogue</a
					>
				</p>
			{:else if displayedRecords.length === 0}
				<div class="notice empty-notice">
					<p>No {data.resource} found.</p>
					{#if data.search}
						<a
							class="inline-action"
							href={resolve('/staff/catalogue/[resource]', { resource: data.resource })}
							>Clear search</a
						>
					{:else}
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a
							class="inline-action"
							href={`${resolve('/staff/catalogue/[resource]', { resource: data.resource })}${querySuffix({ add: 1 })}`}
							>Add {resourceLabel.singular}</a
						>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{/if}
				</div>
			{:else}
				{#if snapshotPreview}
					<p class="notice">
						Showing the Mios teacher list before it is saved. Load it to edit rows, or add a new
						entry.
					</p>
				{/if}
				<div class="table-wrap">
					<table aria-label={`${resourceLabel.plural} catalogue`}>
						<thead>
							<tr>
								<th scope="col">Entry</th>
								<th scope="col">Details</th>
								<th scope="col">Visibility</th>
								<th scope="col">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each displayedRecords as record, index (record.id ?? `${record.courseCode}-${record.section}-${record.bookTitle}-${index}`)}
								<tr>
									<td data-label="Entry">
										<strong>
											{#if data.resource === 'teachers'}
												{record.name}
											{:else if data.resource === 'courses'}
												{record.code}
											{:else if data.resource === 'bookstores'}
												{record.name}
											{:else if data.resource === 'books'}
												{record.title}
											{:else if data.resource === 'entries'}
												{record.courseCode}
												{record.section ? ` ${record.section}` : ''}: {record.bookTitle}
											{:else}
												{record.courseCode}: {record.bookTitle}
											{/if}
										</strong>
										{#if data.resource === 'teachers'}
											<span class="secondary">{record.slug}</span>
										{:else if data.resource === 'courses'}
											<span class="secondary">{record.title}</span>
										{:else if data.resource === 'books' && record.author}
											<span class="secondary">{record.author}</span>
										{:else if data.resource === 'assignments'}
											<span class="secondary">{record.courseTitle}</span>
										{:else if data.resource === 'entries'}
											<span class="secondary"
												>{record.author ? `${record.author}, ` : ''}{record.title}</span
											>
										{/if}
									</td>
									<td data-label="Details">
										{#if data.resource === 'courses'}
											{record.teacherName}
										{:else if data.resource === 'bookstores'}
											${money(record.serviceFeeCents)} service fee
										{:else if data.resource === 'books'}
											{record.bookstoreName ?? 'No bookstore'}{record.priceCents == null
												? ''
												: `, $${money(record.priceCents)}`}
										{:else if data.resource === 'assignments'}
											{record.teacherName}, position {record.position}
										{:else if data.resource === 'entries'}
											{record.instructor}{record.bookstore
												? ` · ${record.bookstore}`
												: ''}{record.isbn ? ` · ${record.isbn}` : ''}{record.notes
												? ` · ${record.notes}`
												: ''}{record.sourceDate ? ` · ${record.sourceDate}` : ''}
										{:else}
											Version {record.version}
										{/if}
									</td>
									<td data-label="Visibility">
										{#if snapshotPreview}
											<span class="state">Out of saved catalogue until loaded</span>
										{:else}
											<span class:inactive={!record.active} class="state">
												Direct: {record.active ? 'Active' : 'Inactive'}
											</span>
											<span class:inactive={!record.effectiveActive} class="state">
												Public: {record.effectiveActive ? 'Visible' : 'Hidden'}
											</span>
											{#if blockedText(record)}
												<span class="blocked">{blockedText(record)}</span>
											{/if}
										{/if}
									</td>
									<td data-label="Actions" class="row-actions">
										{#if snapshotPreview}
											<span class="secondary">Load the teacher list to edit.</span>
										{:else}
											<!-- Query state is appended to a route already resolved with SvelteKit. -->
											<!-- eslint-disable svelte/no-navigation-without-resolve -->
											<a
												href={`${resolve('/staff/catalogue/[resource]', { resource: data.resource })}${querySuffix({ edit: record.id })}`}
												>Edit {recordName(record)}</a
											>
											<!-- eslint-enable svelte/no-navigation-without-resolve -->
											{#if record.active}
												<details>
													<summary>Deactivate?</summary>
													<form
														method="post"
														data-action="deactivate"
														use:enhance={enhanceMutation}
													>
														<input type="hidden" name="id" value={record.id} />
														<input type="hidden" name="version" value={record.version} />
														<button type="submit" formaction="?/deactivate" disabled={submitting}
															>Deactivate {recordName(record)}</button
														>
													</form>
												</details>
											{:else}
												<form method="post" data-action="activate" use:enhance={enhanceMutation}>
													<input type="hidden" name="id" value={record.id} />
													<input type="hidden" name="version" value={record.version} />
													<button type="submit" formaction="?/activate" disabled={submitting}
														>Activate {recordName(record)}</button
													>
												</form>
											{/if}
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			{#if data.resource === 'entries' && data.skippedPacks?.length}
				<section class="skipped-packs" aria-labelledby="skipped-title">
					<h3 id="skipped-title">Out of catalog</h3>
					<p>Course packs are out of the service.</p>
					<ul>
						{#each data.skippedPacks as pack (`${pack.instructor}-${pack.courseCode}-${pack.section}`)}
							<li>{`${pack.instructor} ${pack.courseCode} ${pack.section}: ${pack.reason}`}</li>
						{/each}
					</ul>
				</section>
			{/if}
			{#if data.resource === 'entries' && data.bookstores?.length}
				<section class="bookstore-directory" aria-labelledby="bookstore-title">
					<h3 id="bookstore-title">Bookstores</h3>
					<ul>
						{#each data.bookstores as store (store.name)}
							<li>
								<strong>{store.name}</strong>
								<span class="secondary">{store.address}</span>
								<span class="secondary">{store.notes}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</section>

		{#if data.mode && !data.unavailable}
			<aside class="editor" aria-labelledby="editor-title">
				<header>
					<h2 id="editor-title">{data.mode === 'add' ? 'Add' : 'Edit'} {resourceLabel.singular}</h2>
					<a href={resolve('/staff/catalogue/[resource]', { resource: data.resource })}>Close</a>
				</header>

				<form
					class="editor-form"
					method="post"
					data-action={editorAction}
					use:enhance={enhanceMutation}
				>
					{#if data.mode === 'edit'}
						<input type="hidden" name="id" value={data.selected.id} />
						<input type="hidden" name="version" value={data.selected.version} />
					{/if}

					{#if data.resource === 'teachers'}
						<label for="slug">Slug</label>
						<input
							id="slug"
							name="slug"
							required
							maxlength="120"
							autocomplete="off"
							value={selectedValue('slug')}
							aria-invalid={fieldError('slug') ? 'true' : undefined}
							aria-describedby={fieldError('slug') ? 'slug-error' : undefined}
						/>
						{#if fieldError('slug')}<p id="slug-error" class="field-error">
								{fieldError('slug')}
							</p>{/if}

						<label for="name">Name</label>
						<input
							id="name"
							name="name"
							required
							maxlength="160"
							autocomplete="off"
							value={selectedValue('name')}
							aria-invalid={fieldError('name') ? 'true' : undefined}
							aria-describedby={fieldError('name') ? 'name-error' : undefined}
						/>
						{#if fieldError('name')}<p id="name-error" class="field-error">
								{fieldError('name')}
							</p>{/if}
					{:else if data.resource === 'courses'}
						<label for="teacherId">Teacher</label>
						<select
							id="teacherId"
							name="teacherId"
							required
							aria-invalid={fieldError('teacherId') ? 'true' : undefined}
							aria-describedby={fieldError('teacherId') ? 'teacherId-error' : undefined}
						>
							<option value="">Choose a teacher</option>
							{#each data.options.teachers ?? [] as option (option.id)}
								<option value={option.id} selected={selectedValue('teacherId') === option.id}
									>{optionLabel(option, 'teachers')}</option
								>
							{/each}
						</select>
						{#if fieldError('teacherId')}<p id="teacherId-error" class="field-error">
								{fieldError('teacherId')}
							</p>{/if}

						<label for="code">Course code</label>
						<input
							id="code"
							name="code"
							required
							maxlength="64"
							autocomplete="off"
							value={selectedValue('code')}
							aria-invalid={fieldError('code') ? 'true' : undefined}
							aria-describedby={fieldError('code') ? 'code-error' : undefined}
						/>
						{#if fieldError('code')}<p id="code-error" class="field-error">
								{fieldError('code')}
							</p>{/if}

						<label for="title">Course title</label>
						<input
							id="title"
							name="title"
							required
							maxlength="200"
							autocomplete="off"
							value={selectedValue('title')}
							aria-invalid={fieldError('title') ? 'true' : undefined}
							aria-describedby={fieldError('title') ? 'title-error' : undefined}
						/>
						{#if fieldError('title')}<p id="title-error" class="field-error">
								{fieldError('title')}
							</p>{/if}
					{:else if data.resource === 'bookstores'}
						<label for="name">Name</label>
						<input
							id="name"
							name="name"
							required
							maxlength="160"
							autocomplete="off"
							value={selectedValue('name')}
							aria-invalid={fieldError('name') ? 'true' : undefined}
							aria-describedby={fieldError('name') ? 'name-error' : undefined}
						/>
						{#if fieldError('name')}<p id="name-error" class="field-error">
								{fieldError('name')}
							</p>{/if}

						<label for="serviceFee">Service fee, CAD</label>
						<input
							id="serviceFee"
							name="serviceFee"
							type="text"
							inputmode="decimal"
							required
							placeholder="5.00"
							value={selectedValue('serviceFee')}
							aria-invalid={fieldError('serviceFee') ? 'true' : undefined}
							aria-describedby={fieldError('serviceFee') ? 'serviceFee-error' : undefined}
						/>
						{#if fieldError('serviceFee')}<p id="serviceFee-error" class="field-error">
								{fieldError('serviceFee')}
							</p>{/if}
					{:else if data.resource === 'books'}
						<label for="bookstoreId">Bookstore</label>
						<select
							id="bookstoreId"
							name="bookstoreId"
							required
							aria-invalid={fieldError('bookstoreId') ? 'true' : undefined}
							aria-describedby={fieldError('bookstoreId') ? 'bookstoreId-error' : undefined}
						>
							<option value="">Choose a bookstore</option>
							{#each data.options.bookstores ?? [] as option (option.id)}
								<option value={option.id} selected={selectedValue('bookstoreId') === option.id}
									>{optionLabel(option, 'bookstores')}</option
								>
							{/each}
						</select>
						{#if fieldError('bookstoreId')}<p id="bookstoreId-error" class="field-error">
								{fieldError('bookstoreId')}
							</p>{/if}

						<label for="title">Title</label>
						<input
							id="title"
							name="title"
							required
							maxlength="240"
							value={selectedValue('title')}
							aria-invalid={fieldError('title') ? 'true' : undefined}
							aria-describedby={fieldError('title') ? 'title-error' : undefined}
						/>
						{#if fieldError('title')}<p id="title-error" class="field-error">
								{fieldError('title')}
							</p>{/if}

						<label for="author">Author, optional</label>
						<input
							id="author"
							name="author"
							maxlength="200"
							value={selectedValue('author')}
							aria-invalid={fieldError('author') ? 'true' : undefined}
							aria-describedby={fieldError('author') ? 'author-error' : undefined}
						/>
						{#if fieldError('author')}<p id="author-error" class="field-error">
								{fieldError('author')}
							</p>{/if}

						<label for="isbn">ISBN, optional</label>
						<input
							id="isbn"
							name="isbn"
							maxlength="32"
							inputmode="numeric"
							value={selectedValue('isbn')}
							aria-invalid={fieldError('isbn') ? 'true' : undefined}
							aria-describedby={fieldError('isbn') ? 'isbn-error' : undefined}
						/>
						{#if fieldError('isbn')}<p id="isbn-error" class="field-error">
								{fieldError('isbn')}
							</p>{/if}

						<label for="retailerUrl">Retailer URL</label>
						<input
							id="retailerUrl"
							name="retailerUrl"
							type="url"
							required
							maxlength="2048"
							value={selectedValue('retailerUrl')}
							aria-invalid={fieldError('retailerUrl') ? 'true' : undefined}
							aria-describedby={fieldError('retailerUrl') ? 'retailerUrl-error' : undefined}
						/>
						{#if fieldError('retailerUrl')}<p id="retailerUrl-error" class="field-error">
								{fieldError('retailerUrl')}
							</p>{/if}

						<label for="coverUrl">Cover URL, optional</label>
						<input
							id="coverUrl"
							name="coverUrl"
							type="url"
							maxlength="2048"
							value={selectedValue('coverUrl')}
							aria-invalid={fieldError('coverUrl') ? 'true' : undefined}
							aria-describedby={fieldError('coverUrl') ? 'coverUrl-error' : undefined}
						/>
						{#if fieldError('coverUrl')}<p id="coverUrl-error" class="field-error">
								{fieldError('coverUrl')}
							</p>{/if}

						<label for="price">Price, CAD</label>
						<input
							id="price"
							name="price"
							type="text"
							inputmode="decimal"
							required
							placeholder="0.00"
							value={selectedValue('price')}
							aria-invalid={fieldError('price') ? 'true' : undefined}
							aria-describedby={fieldError('price') ? 'price-error' : undefined}
						/>
						{#if fieldError('price')}<p id="price-error" class="field-error">
								{fieldError('price')}
							</p>{/if}
					{:else if data.resource === 'entries'}
						{#each ENTRY_FIELDS as field (field.name)}
							<label for={field.name}>{field.label}{field.required ? '' : ', optional'}</label>
							{#if field.textarea}
								<textarea
									id={field.name}
									name={field.name}
									maxlength={field.maxlength}
									required={field.required ? true : undefined}
									value={selectedValue(field.name)}
									aria-invalid={fieldError(field.name) ? 'true' : undefined}
									aria-describedby={fieldError(field.name) ? `${field.name}-error` : undefined}
								></textarea>
							{:else}
								<input
									id={field.name}
									name={field.name}
									type={field.type ?? 'text'}
									maxlength={field.maxlength}
									required={field.required ? true : undefined}
									autocomplete="off"
									value={selectedValue(field.name)}
									aria-invalid={fieldError(field.name) ? 'true' : undefined}
									aria-describedby={fieldError(field.name) ? `${field.name}-error` : undefined}
								/>
							{/if}
							{#if fieldError(field.name)}<p id={`${field.name}-error`} class="field-error">
									{fieldError(field.name)}
								</p>{/if}
						{/each}
					{:else}
						{#if data.mode === 'add'}
							<label for="courseId">Course</label>
							<select
								id="courseId"
								name="courseId"
								required
								aria-invalid={fieldError('courseId') ? 'true' : undefined}
								aria-describedby={fieldError('courseId') ? 'courseId-error' : undefined}
							>
								<option value="">Choose a course</option>
								{#each data.options.courses ?? [] as option (option.id)}
									<option value={option.id} selected={selectedValue('courseId') === option.id}
										>{optionLabel(option, 'courses')}</option
									>
								{/each}
							</select>
							{#if fieldError('courseId')}<p id="courseId-error" class="field-error">
									{fieldError('courseId')}
								</p>{/if}

							<label for="bookId">Book</label>
							<select
								id="bookId"
								name="bookId"
								required
								aria-invalid={fieldError('bookId') ? 'true' : undefined}
								aria-describedby={fieldError('bookId') ? 'bookId-error' : undefined}
							>
								<option value="">Choose a book</option>
								{#each data.options.books ?? [] as option (option.id)}
									<option value={option.id} selected={selectedValue('bookId') === option.id}
										>{optionLabel(option, 'books')}</option
									>
								{/each}
							</select>
							{#if fieldError('bookId')}<p id="bookId-error" class="field-error">
									{fieldError('bookId')}
								</p>{/if}
						{:else}
							<dl class="assignment-identity">
								<div>
									<dt>Course</dt>
									<dd>{data.selected.courseCode}, {data.selected.courseTitle}</dd>
								</div>
								<div>
									<dt>Book</dt>
									<dd>{data.selected.bookTitle}</dd>
								</div>
							</dl>
						{/if}

						<label for="position">Position</label>
						<input
							id="position"
							name="position"
							type="number"
							min="0"
							max="9999"
							step="1"
							required
							value={selectedValue('position', '0')}
							aria-invalid={fieldError('position') ? 'true' : undefined}
							aria-describedby={fieldError('position') ? 'position-error' : undefined}
						/>
						{#if fieldError('position')}<p id="position-error" class="field-error">
								{fieldError('position')}
							</p>{/if}
					{/if}

					<button
						class="primary-action"
						type="submit"
						formaction={`?/${editorAction}`}
						disabled={submitting}
					>
						{data.mode === 'add' ? 'Add' : 'Save'}
						{resourceLabel.singular}
					</button>
				</form>
			</aside>
		{/if}
	</div>
</section>

<style>
	.catalogue-page {
		padding: clamp(1.25rem, 3vw, 2.5rem) var(--page-gutter) 4rem;
	}

	.catalogue-heading,
	.list-heading,
	.editor > header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
	}

	.catalogue-heading {
		min-height: 7rem;
		padding-bottom: 1.5rem;
	}

	h1 {
		font-size: var(--text-3xl);
	}

	.resource-nav {
		display: flex;
		flex-wrap: wrap;
		border-block: var(--rule-strong);
	}

	.resource-nav a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0 1rem;
		border-right: var(--rule);
		color: inherit;
		font-size: var(--text-sm);
		font-weight: 650;
		text-decoration: none;
	}

	.resource-nav a[aria-current='page'] {
		background: var(--midnight);
		color: white;
	}

	.catalogue-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}

	.catalogue-grid.with-editor {
		grid-template-columns: minmax(0, 1fr) minmax(20rem, 27rem);
	}

	.catalogue-list {
		min-width: 0;
		padding-top: 2rem;
	}

	.list-heading {
		padding-bottom: 1rem;
	}

	.list-heading h2,
	.editor h2 {
		font-size: var(--text-xl);
	}

	.list-heading p {
		margin-top: 0.2rem;
		color: var(--color-muted);
		font-size: var(--text-sm);
	}

	.add-link,
	.editor > header a {
		color: var(--club-blue);
		font-size: var(--text-sm);
		font-weight: 650;
	}

	.add-link,
	.editor > header a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
	}

	.editor > header a {
		justify-content: center;
		min-width: 2.75rem;
	}

	.search-form {
		padding: 1rem 0 1.5rem;
		border-top: var(--rule);
	}

	.search-form > label {
		display: block;
		margin-bottom: 0.35rem;
		font-size: var(--text-sm);
		font-weight: 650;
	}

	.search-form > div {
		display: flex;
		width: min(100%, 32rem);
	}

	.search-form input {
		min-width: 0;
		flex: 1;
	}

	input,
	select,
	textarea,
	.search-form button,
	.primary-action,
	.row-actions button {
		min-height: 2.75rem;
		border: var(--rule-strong);
		border-radius: 0;
		background: white;
		color: inherit;
	}

	input,
	select,
	textarea {
		width: 100%;
		padding: 0.6rem 0.7rem;
	}

	textarea {
		min-height: 6rem;
		resize: vertical;
	}

	.search-form button,
	.primary-action,
	.row-actions button {
		padding: 0.55rem 0.85rem;
		font-weight: 650;
		cursor: pointer;
	}

	.search-form button,
	.primary-action {
		background: var(--midnight);
		color: white;
	}

	.table-wrap {
		width: 100%;
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}

	th,
	td {
		padding: 0.85rem 0.75rem;
		border-top: var(--rule);
		text-align: left;
		vertical-align: top;
	}

	th {
		color: var(--color-muted);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	td:first-child {
		width: 31%;
	}

	.secondary,
	.state,
	.blocked {
		display: block;
	}

	.secondary,
	.blocked {
		margin-top: 0.2rem;
		color: var(--color-muted);
	}

	.state {
		width: max-content;
		max-width: 100%;
		font-size: var(--text-xs);
		font-weight: 650;
	}

	.state.inactive,
	.blocked,
	.field-error,
	.error-summary,
	.error-notice {
		color: var(--danger);
	}

	.row-actions {
		width: 12rem;
	}

	.row-actions > a,
	.row-actions summary {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		color: var(--club-blue);
		font-weight: 650;
	}

	.row-actions details,
	.row-actions form {
		margin-top: 0.35rem;
	}

	.row-actions summary {
		cursor: pointer;
	}

	.row-actions button {
		border-color: var(--danger);
		color: var(--danger);
	}

	.editor {
		min-width: 0;
		padding: 2rem 0 2rem 2rem;
		border-left: var(--rule-strong);
	}

	.editor > header {
		padding-bottom: 1rem;
		border-bottom: var(--rule);
	}

	.error-summary,
	.notice,
	.action-message {
		padding: 0.8rem 0;
		font-size: var(--text-sm);
	}

	.empty-notice {
		display: grid;
		gap: 0.5rem;
		justify-items: start;
	}

	.empty-notice p,
	.error-notice {
		margin: 0;
	}

	.error-notice {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}

	.inline-action {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		color: var(--club-blue);
		font-weight: 650;
		text-decoration: none;
	}

	.error-summary {
		display: grid;
		gap: 0.25rem;
		padding-inline: var(--page-gutter);
		border-block: 2px solid currentColor;
		outline: 3px solid transparent;
		outline-offset: -3px;
	}

	.error-summary:focus {
		outline-color: var(--club-blue);
	}

	.action-message {
		color: var(--club-blue);
		font-weight: 650;
	}

	.editor-form {
		display: grid;
		padding-top: 1rem;
	}

	.editor-form label {
		margin-top: 0.8rem;
		margin-bottom: 0.25rem;
		font-size: var(--text-sm);
		font-weight: 650;
	}

	.editor-form label:first-of-type {
		margin-top: 0;
	}

	.editor-form [aria-invalid='true'] {
		border-color: var(--danger);
		box-shadow: inset 3px 0 0 var(--danger);
	}

	.field-error {
		margin-top: 0.25rem;
		font-size: var(--text-xs);
	}

	.primary-action {
		width: 100%;
		margin-top: 1.5rem;
	}

	.assignment-identity {
		border-block: var(--rule);
	}

	.assignment-identity div {
		padding: 0.7rem 0;
	}

	.assignment-identity div + div {
		border-top: var(--rule);
	}

	.assignment-identity dt {
		color: var(--color-muted);
		font-size: var(--text-xs);
		font-weight: 650;
		text-transform: uppercase;
	}

	.assignment-identity dd {
		margin: 0.2rem 0 0;
	}

	.source-panel,
	.skipped-packs,
	.bookstore-directory {
		padding: 1rem 0 0;
		font-size: var(--text-sm);
	}

	.source-panel,
	.skipped-packs {
		border-bottom: var(--rule);
	}

	.notice-list,
	.skipped-packs ul,
	.bookstore-directory ul {
		margin: 0.6rem 0 0;
		padding-left: 1.2rem;
	}

	.skipped-packs h3,
	.bookstore-directory h3 {
		font-size: var(--text-sm);
		font-weight: 650;
	}

	.source-panel .primary-action {
		width: auto;
		margin-top: 0.85rem;
	}

	button:disabled {
		cursor: wait;
		opacity: 0.55;
	}

	:global(.staff-shell a:focus-visible),
	input:focus-visible,
	select:focus-visible,
	textarea:focus-visible,
	button:focus-visible,
	summary:focus-visible {
		outline: var(--focus-ring-width) solid var(--color-focus);
		outline-offset: var(--focus-ring-offset);
	}

	@media (max-width: 70rem) {
		.catalogue-grid.with-editor {
			grid-template-columns: minmax(0, 1fr);
		}

		.editor {
			padding: 2rem 0;
			border-top: var(--rule-strong);
			border-left: 0;
		}
	}

	@media (max-width: 48rem) {
		.catalogue-heading {
			align-items: flex-start;
			flex-direction: column;
			justify-content: flex-end;
		}

		.resource-nav a {
			flex: 1 1 auto;
			border-bottom: var(--rule);
		}

		.table-wrap {
			overflow: visible;
		}

		table,
		tbody,
		tr,
		td {
			display: block;
			width: 100%;
		}

		thead {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
			clip-path: inset(50%);
			white-space: nowrap;
		}

		tr {
			padding: 0.75rem 0;
			border-top: var(--rule-strong);
		}

		td,
		td:first-child,
		.row-actions {
			display: grid;
			grid-template-columns: minmax(5.5rem, 30%) minmax(0, 1fr);
			gap: 0.75rem;
			width: 100%;
			padding: 0.45rem 0;
			border: 0;
		}

		td::before {
			color: var(--color-muted);
			content: attr(data-label);
			font-family: var(--font-mono);
			font-size: var(--text-xs);
			font-weight: 600;
			text-transform: uppercase;
		}
	}

	@media (max-width: 24rem) {
		.catalogue-page {
			padding-inline: 0.75rem;
		}

		.search-form > div,
		.list-heading {
			align-items: stretch;
			flex-direction: column;
		}

		.add-link {
			display: inline-flex;
			align-items: center;
			min-height: 2.75rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		* {
			scroll-behavior: auto;
		}
	}

	@media (forced-colors: active) {
		.resource-nav a[aria-current='page'],
		.primary-action,
		.search-form button {
			background: Highlight;
			color: HighlightText;
		}
	}
</style>
