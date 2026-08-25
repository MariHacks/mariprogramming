<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';

	export let data;
	export let form;
</script>

<svelte:head>
	<title>{data.thread?.title ?? 'Thread'} | Forum | {MARITOOLS_NAME}</title>
</svelte:head>

<section class="thread-page page-container">
	{#if data.notFound}
		<p>That thread is not available.</p>
		<p><a href="/tools/forum">Back to forum</a></p>
	{:else if data.unavailable}
		<p class="error" role="alert">This thread is unavailable right now.</p>
	{:else if data.thread}
		<header>
			<p><a href="/tools/forum">Forum</a></p>
			<h1>{data.thread.title}</h1>
			<p class="meta">{data.thread.category}</p>
			{#if data.thread.lockedAt}
				<p class="locked">Thread locked.</p>
			{/if}
		</header>

		<article class="post">
			<p>{data.thread.body}</p>
			{#if data.signedIn}
				<form method="POST" action="?/report" class="report">
					<input type="hidden" name="targetKind" value="thread" />
					<input type="hidden" name="targetId" value={data.thread.id} />
					<label>
						Report thread
						<input name="reason" maxlength="500" placeholder="Why?" required />
					</label>
					<button type="submit">Report</button>
				</form>
			{/if}
		</article>

		<section class="replies">
			<h2>Replies</h2>
			{#if data.replies.length === 0}
				<p>No replies yet.</p>
			{:else}
				<ul>
					{#each data.replies as reply (reply.id)}
						<li>
							<p>{reply.body}</p>
							{#if data.signedIn}
								<form method="POST" action="?/report" class="report">
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
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		{#if data.canReply}
			<section class="panel">
				<h2>Reply</h2>
				<form method="POST" action="?/reply" class="stack">
					<label>
						Your reply
						<textarea name="body" rows="4" required maxlength="20000"></textarea>
					</label>
					<button type="submit" class="primary">Post reply</button>
				</form>
			</section>
		{/if}

		{#if data.staff}
			<section class="panel staff">
				<h2>Staff moderation</h2>
				<form method="POST" action="?/moderate">
					<button type="submit" name="moderation" value="lock">Lock thread</button>
					<button type="submit" name="moderation" value="remove-thread">Remove thread</button>
				</form>
			</section>
		{/if}

		{#if form?.replied}
			<p class="success">Reply posted.</p>
		{/if}
		{#if form?.reported}
			<p class="success">Report filed.</p>
		{/if}
		{#if form?.moderated}
			<p class="success">Moderation applied.</p>
		{/if}
		{#if form?.error}
			<p class="error" role="alert">{form.error}</p>
		{/if}
	{/if}
</section>

<style>
	.thread-page {
		display: grid;
		padding-block: var(--space-xl);
		gap: var(--space-lg);
	}

	h1 {
		font-family: var(--font-display);
		font-size: var(--text-2xl);
		line-height: 1.1;
	}

	.meta,
	.locked {
		color: var(--quiet-steel);
		font-size: var(--text-sm);
	}

	.post,
	.replies li,
	.panel {
		border-block-start: var(--rule);
		padding-block-start: var(--space-md);
	}

	.replies ul {
		list-style: none;
		padding: 0;
		display: grid;
		gap: var(--space-md);
	}

	.stack,
	.report {
		display: grid;
		gap: var(--space-sm);
		max-width: 40rem;
	}

	label {
		display: grid;
		gap: var(--space-3xs);
		font-weight: 600;
	}

	input,
	textarea,
	button {
		font: inherit;
	}

	input,
	textarea {
		width: 100%;
		border: var(--rule-strong);
		border-radius: var(--radius-sm);
		padding: var(--space-sm);
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

	.error {
		color: var(--danger);
	}

	.success {
		color: var(--graphite);
	}
</style>
