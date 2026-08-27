<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';

	export let data;
	export let form;

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
</script>

<svelte:head>
	<title>{data.thread?.title ?? 'Thread'} | Forum | {MARITOOLS_NAME}</title>
</svelte:head>

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
						<p>{data.thread.body}</p>
						<footer>
							{#if data.thread.createdAt}
								<time datetime={String(data.thread.createdAt)}>{formatWhen(data.thread.createdAt)}</time>
							{/if}
							<div>
								{#if data.signedIn}
									<form method="POST" action="?/report">
										<input type="hidden" name="targetKind" value="thread" />
										<input type="hidden" name="targetId" value={data.thread.id} />
										<label>
											Report thread
											<input name="reason" maxlength="500" placeholder="Why?" required />
										</label>
										<button type="submit">Report</button>
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
								<p>{reply.body}</p>
								<footer>
									{#if reply.createdAt}
										<time datetime={String(reply.createdAt)}>{formatWhen(reply.createdAt)}</time>
									{/if}
									<div>
										{#if data.signedIn}
											<form method="POST" action="?/report">
												<input type="hidden" name="targetKind" value="reply" />
												<input type="hidden" name="targetId" value={reply.id} />
												<label>
													Report
													<input name="reason" maxlength="500" placeholder="Why?" required />
												</label>
												<button type="submit">Report</button>
											</form>
										{/if}
										{#if data.staff}
											<form method="POST" action="?/moderate">
												<input type="hidden" name="moderation" value="remove-reply" />
												<input type="hidden" name="replyId" value={reply.id} />
												<button type="submit">Remove reply</button>
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
				{/if}

				{#if data.staff}
					<section class="reply-editor">
						<strong>Staff moderation</strong>
						<form method="POST" action="?/moderate">
							<button type="submit" name="moderation" value="lock" class="quiet-button">Lock thread</button>
							<button type="submit" name="moderation" value="remove-thread" class="quiet-button">Remove thread</button>
						</form>
					</section>
				{/if}

				{#if form?.replied}
					<p role="status">Reply posted.</p>
				{/if}
				{#if form?.reported}
					<p role="status">Report filed.</p>
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
