<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';

	export let data;
	export let form;

	/** @type {string | null} */
	let openReportId = null;
	/** @type {string | null} */
	let editingId = null;

	/** @param {string | Date | null | undefined} value */
	function formatWhen(value) {
		if (!value) return '';
		const date = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return date.toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	/** @param {string} category */
	function categoryLabel(category) {
		if (category === 'courses') return 'Course help';
		if (category === 'student-life') return 'Student life';
		return category;
	}

	/** @param {string | Date | null | undefined} value */
	function startedLine(value) {
		if (!value) return '';
		const date = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return `Started ${date.toLocaleString(undefined, { month: 'long', day: 'numeric' })}`;
	}

	/** @param {string} id */
	function reportControlId(id) {
		return `report-popover-${id}`;
	}

	/** @param {string} id */
	function toggleReport(id) {
		openReportId = openReportId === id ? null : id;
		if (openReportId) editingId = null;
	}

	/** @param {string} id */
	function toggleEdit(id) {
		editingId = editingId === id ? null : id;
		if (editingId) openReportId = null;
	}

	function closeReport() {
		openReportId = null;
	}

	/** @param {KeyboardEvent} event */
	function handleKeydown(event) {
		if (event.key !== 'Escape') return;
		if (openReportId) closeReport();
		else if (editingId) editingId = null;
	}

	/** @param {PointerEvent} event */
	function handleOutsidePointer(event) {
		if (!openReportId) return;
		if (!(event.target instanceof Node)) return;
		const open = document.querySelector(`[data-report-for="${openReportId}"]`);
		if (open && !open.contains(event.target)) closeReport();
	}
</script>

<svelte:head>
	<title>{data.thread?.title ?? 'Thread'} | Forum | {MARITOOLS_NAME}</title>
</svelte:head>

<svelte:window on:keydown={handleKeydown} />
<svelte:document on:pointerdown={handleOutsidePointer} />

<div class="mt-preview">
	<section class="page page-thread">
		{#if data.notFound}
			<p>That thread is not available.</p>
			<p><a href="/tools/forum">Back to forum</a></p>
		{:else if data.unavailable}
			<p class="field-error" role="alert">This thread is unavailable right now.</p>
		{:else if data.thread}
			<header class="thread-header">
				<nav>
					<a href="/tools/forum">← All discussions</a>
					<span>{categoryLabel(data.thread.category)}</span>
					{#if data.thread.courseCode}
						<span>{data.thread.courseCode}</span>
					{/if}
				</nav>
				<h1>{data.thread.title}</h1>
				{#if data.thread.createdAt}
					<p>{startedLine(data.thread.createdAt)}</p>
				{/if}
				{#if data.thread.lockedAt}
					<p>Thread locked.</p>
				{/if}
			</header>

			<div class="thread-layout">
				<article class="post origin">
					<aside>
						<span class="post-avatar">ST</span>
						<strong>Student</strong>
						<small>Original poster</small>
					</aside>
					<div class="post-body">
						{#if editingId === data.thread.id}
							<form method="POST" action="?/edit" class="post-edit">
								<input type="hidden" name="targetKind" value="thread" />
								<input type="hidden" name="targetId" value={data.thread.id} />
								<label>
									<span class="sr-only">Edit thread</span>
									<textarea name="body" rows="4" required maxlength="20000"
										>{data.thread.body}</textarea
									>
								</label>
								<footer>
									<button type="submit">Save edit</button>
									<button type="button" on:click={() => (editingId = null)}>Cancel</button>
								</footer>
							</form>
						{:else}
							<p>{data.thread.body}</p>
						{/if}
						<footer>
							{#if data.thread.createdAt}
								<time datetime={String(data.thread.createdAt)}>{formatWhen(data.thread.createdAt)}</time>
							{/if}
							<div class="post-actions">
								{#if data.signedIn}
									<div class="report-control" data-report-for={data.thread.id}>
										<button
											type="button"
											aria-expanded={openReportId === data.thread.id}
											aria-controls={reportControlId(data.thread.id)}
											on:click={() => toggleReport(data.thread.id)}
										>
											Report
										</button>
										{#if openReportId === data.thread.id}
											<form
												method="POST"
												action="?/report"
												id={reportControlId(data.thread.id)}
												class="report-popover"
												role="group"
												aria-label="Report thread"
											>
												<input type="hidden" name="targetKind" value="thread" />
												<input type="hidden" name="targetId" value={data.thread.id} />
												<label>
													<span class="sr-only">Why are you reporting this?</span>
													<input
														name="reason"
														maxlength="500"
														placeholder="Why are you reporting this?"
														required
													/>
												</label>
												<button type="submit">Submit report</button>
											</form>
										{/if}
									</div>
								{/if}
								{#if data.thread.canManage}
									<button type="button" on:click={() => toggleEdit(data.thread.id)}>Edit</button>
									<form method="POST" action="?/delete">
										<input type="hidden" name="targetKind" value="thread" />
										<input type="hidden" name="targetId" value={data.thread.id} />
										<button type="submit">Delete</button>
									</form>
								{/if}
							</div>
						</footer>
					</div>
				</article>

				{#if data.replies.length === 0}
					<p>No replies yet.</p>
				{:else}
					{#each data.replies as reply (reply.id)}
						<article class="post">
							<aside>
								<span class="post-avatar post-avatar--blue">ST</span>
								<strong>Student</strong>
								<small>Reply</small>
							</aside>
							<div class="post-body">
								{#if editingId === reply.id}
									<form method="POST" action="?/edit" class="post-edit">
										<input type="hidden" name="targetKind" value="reply" />
										<input type="hidden" name="targetId" value={reply.id} />
										<label>
											<span class="sr-only">Edit reply</span>
											<textarea name="body" rows="4" required maxlength="20000">{reply.body}</textarea>
										</label>
										<footer>
											<button type="submit">Save edit</button>
											<button type="button" on:click={() => (editingId = null)}>Cancel</button>
										</footer>
									</form>
								{:else}
									<p>{reply.body}</p>
								{/if}
								<footer>
									{#if reply.createdAt}
										<time datetime={String(reply.createdAt)}>{formatWhen(reply.createdAt)}</time>
									{/if}
									<div class="post-actions">
										{#if data.signedIn}
											<div class="report-control" data-report-for={reply.id}>
												<button
													type="button"
													aria-expanded={openReportId === reply.id}
													aria-controls={reportControlId(reply.id)}
													on:click={() => toggleReport(reply.id)}
												>
													Report
												</button>
												{#if openReportId === reply.id}
													<form
														method="POST"
														action="?/report"
														id={reportControlId(reply.id)}
														class="report-popover"
														role="group"
														aria-label="Report reply"
													>
														<input type="hidden" name="targetKind" value="reply" />
														<input type="hidden" name="targetId" value={reply.id} />
														<label>
															<span class="sr-only">Why are you reporting this?</span>
															<input
																name="reason"
																maxlength="500"
																placeholder="Why are you reporting this?"
																required
															/>
														</label>
														<button type="submit">Submit report</button>
													</form>
												{/if}
											</div>
										{/if}
										{#if reply.canManage}
											<button type="button" on:click={() => toggleEdit(reply.id)}>Edit</button>
											<form method="POST" action="?/delete">
												<input type="hidden" name="targetKind" value="reply" />
												<input type="hidden" name="targetId" value={reply.id} />
												<button type="submit">Delete</button>
											</form>
										{/if}
									</div>
								</footer>
							</div>
						</article>
					{/each}
				{/if}

				{#if data.canReply}
					<section class="reply-editor">
						<div>
							<span class="post-avatar">YO</span>
							<strong>Reply to this discussion</strong>
						</div>
						<form method="POST" action="?/reply">
							<textarea
								name="body"
								rows="4"
								required
								maxlength="20000"
								placeholder="Write a clear, useful reply…"
							></textarea>
							<footer>
								<span>Write enough context to be useful.</span>
								<button type="submit" class="primary-button">Post reply</button>
							</footer>
						</form>
					</section>
				{:else if !data.signedIn}
					<section class="guest-composer" aria-label="Replying requires sign-in">
						<p>Sign in with Google to reply. Reading stays open without an account.</p>
						<a class="primary-button" href="/tools/account">Sign in with Google</a>
					</section>
				{/if}

				{#if data.staff}
					<section class="reply-editor">
						<strong>Staff moderation</strong>
						<form method="POST" action="?/moderate">
							<button type="submit" name="moderation" value="lock" class="quiet-button">Lock thread</button>
							<button type="submit" name="moderation" value="remove-thread" class="quiet-button"
								>Remove thread</button
							>
						</form>
					</section>
				{/if}

				{#if form?.replied}
					<p role="status">Reply posted.</p>
				{/if}
				{#if form?.reported}
					<p role="status">Report filed.</p>
				{/if}
				{#if form?.edited}
					<p role="status">Edit saved.</p>
				{/if}
				{#if form?.deleted}
					<p role="status">Post deleted.</p>
				{/if}
				{#if form?.moderated}
					<p role="status">Moderation applied.</p>
				{/if}
				{#if form?.error}
					<p class="field-error" role="alert">{form.error}</p>
				{/if}
			</div>
		{/if}
	</section>
</div>
