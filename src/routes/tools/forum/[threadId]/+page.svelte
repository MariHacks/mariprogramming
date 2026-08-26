<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';
	import '$lib/maritools/styles/index-pages.css';

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
</script>

<svelte:head>
	<title>{data.thread?.title ?? 'Thread'} | Forum | {MARITOOLS_NAME}</title>
</svelte:head>

<section class="mt-index-page mt-thread-page">
	{#if data.notFound}
		<p class="mt-thread-empty">That thread is not available.</p>
		<p><a href="/tools/forum">Back to forum</a></p>
	{:else if data.unavailable}
		<p class="mt-error" role="alert">This thread is unavailable right now.</p>
	{:else if data.thread}
		<header class="mt-thread-header">
			<nav>
				<a href="/tools/forum">← All discussions</a>
				<span>{data.thread.category}</span>
			</nav>
			<h1>{data.thread.title}</h1>
			{#if data.thread.createdAt}
				<p class="mt-thread-meta">Started {formatWhen(data.thread.createdAt)}</p>
			{/if}
			{#if data.thread.lockedAt}
				<p class="mt-thread-locked">Thread locked.</p>
			{/if}
		</header>

		<div class="mt-thread-layout">
			<article class="mt-thread-post mt-thread-post--origin">
				<div class="mt-thread-post-body">
					<p>{data.thread.body}</p>
					<footer class="mt-thread-post-footer">
						{#if data.thread.createdAt}
							<time datetime={String(data.thread.createdAt)}>{formatWhen(data.thread.createdAt)}</time>
						{/if}
						{#if data.signedIn}
							<form method="POST" action="?/report" class="mt-thread-report">
								<input type="hidden" name="targetKind" value="thread" />
								<input type="hidden" name="targetId" value={data.thread.id} />
								<label>
									Report thread
									<input name="reason" maxlength="500" placeholder="Why?" required />
								</label>
								<button type="submit">Report</button>
							</form>
						{/if}
					</footer>
				</div>
			</article>

			<section class="mt-thread-replies">
				<h2>Replies</h2>
				{#if data.replies.length === 0}
					<p class="mt-thread-empty">No replies yet.</p>
				{:else}
					{#each data.replies as reply (reply.id)}
						<article class="mt-thread-post">
							<div class="mt-thread-post-body">
								<p>{reply.body}</p>
								<footer class="mt-thread-post-footer">
									{#if reply.createdAt}
										<time datetime={String(reply.createdAt)}>{formatWhen(reply.createdAt)}</time>
									{/if}
									{#if data.signedIn}
										<form method="POST" action="?/report" class="mt-thread-report">
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
										<form method="POST" action="?/moderate" class="mt-thread-staff">
											<input type="hidden" name="moderation" value="remove-reply" />
											<input type="hidden" name="replyId" value={reply.id} />
											<button type="submit">Remove reply</button>
										</form>
									{/if}
								</footer>
							</div>
						</article>
					{/each}
				{/if}
			</section>

			{#if data.canReply}
				<section class="mt-thread-reply-editor">
					<h2>Reply to this discussion</h2>
					<form method="POST" action="?/reply" class="mt-stack">
						<label>
							Your reply
							<textarea name="body" rows="4" required maxlength="20000"></textarea>
						</label>
						<button type="submit" class="mt-primary-button">Post reply</button>
					</form>
				</section>
			{/if}

			{#if data.staff}
				<section class="mt-panel mt-thread-staff">
					<h2>Staff moderation</h2>
					<form method="POST" action="?/moderate">
						<button type="submit" name="moderation" value="lock">Lock thread</button>
						<button type="submit" name="moderation" value="remove-thread">Remove thread</button>
					</form>
				</section>
			{/if}

			{#if form?.replied}
				<p class="mt-thread-status success" role="status">Reply posted.</p>
			{/if}
			{#if form?.reported}
				<p class="mt-thread-status success" role="status">Report filed.</p>
			{/if}
			{#if form?.moderated}
				<p class="mt-thread-status success" role="status">Moderation applied.</p>
			{/if}
			{#if form?.error}
				<p class="mt-error" role="alert">{form.error}</p>
			{/if}
		</div>
	{/if}
</section>
