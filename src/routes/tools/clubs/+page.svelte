<script>
	import { MARITOOLS_NAME } from '$lib/maritools/brand.js';

	export let data;
	export let form = null;
</script>

<svelte:head>
	<title>Clubs | {MARITOOLS_NAME}</title>
	<meta
		name="description"
		content="Browse published campus clubs and send a listing for staff to review."
	/>
</svelte:head>

<section class="clubs-page page-container">
	<header class="intro">
		<h1>Clubs</h1>
		<p>
			Published listings students have sent in. Rooms stay off this page until staff check them.
		</p>
	</header>

	<form method="GET" class="filters">
		<label>
			Search
			<input name="q" value={data.query} />
		</label>
		<label>
			Category
			<input name="category" value={data.category} />
		</label>
		<button type="submit" class="primary">Show clubs</button>
	</form>

	{#if data.unavailable}
		<p class="error" role="alert">Clubs are unavailable right now. Try again.</p>
	{:else if data.clubs.length === 0}
		<p>No published clubs yet.</p>
	{:else}
		<ul class="club-list">
			{#each data.clubs as club (club.id)}
				<li>
					<article>
						<h2>{club.name}</h2>
						{#if club.category}
							<p class="meta">{club.category}</p>
						{/if}
						{#if club.description}
							<p>{club.description}</p>
						{/if}
						{#if Array.isArray(club.links) && club.links.length}
							<ul class="links">
								{#each club.links as link, index (`${club.id}-link-${index}`)}
									<li>
										<a href={link.url} rel="noopener noreferrer">{link.label ?? 'Website'}</a>
									</li>
								{/each}
							</ul>
						{/if}
					</article>
				</li>
			{/each}
		</ul>
	{/if}

	{#if data.signedIn}
		<section class="panel">
			<h2>Submit a club</h2>
			<p>Staff publish a listing after they check it.</p>
			<form method="POST" action="?/submit" class="stack">
				<label>
					Club name
					<input name="name" required maxlength="160" />
				</label>
				<label>
					Category
					<input name="category" maxlength="80" />
				</label>
				<label>
					Description
					<textarea name="description" rows="4" maxlength="4000"></textarea>
				</label>
				<label>
					Link label
					<input name="linkLabel" maxlength="80" />
				</label>
				<label>
					Website
					<input name="linkUrl" type="url" maxlength="500" />
				</label>
				<button type="submit" class="primary">Send for review</button>
			</form>
			{#if form?.submitted}
				<p class="status" role="status">Sent for review.</p>
			{/if}
			{#if form?.error}
				<p class="error" role="alert">{form.error}</p>
			{/if}
		</section>
	{:else}
		<p><a href="/tools/account">Sign in with Google</a> to submit a club.</p>
	{/if}

	{#if data.staff}
		<section class="panel">
			<h2>Pending listings</h2>
			{#if form?.published}
				<p class="status" role="status">Published.</p>
			{/if}
			{#if data.pending.length === 0}
				<p>No pending submissions.</p>
			{:else}
				<ul class="pending">
					{#each data.pending as submission (submission.id)}
						<li>
							<strong>{submission.name}</strong>
							{#if submission.category}
								<span class="meta">{submission.category}</span>
							{/if}
							{#if submission.description}
								<p>{submission.description}</p>
							{/if}
							<form method="POST" action="?/publish">
								<input type="hidden" name="submissionId" value={submission.id} />
								<button type="submit" class="primary">Publish</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</section>

<style>
	.clubs-page {
		display: grid;
		padding-block: var(--space-xl);
		gap: var(--space-md);
	}

	.intro h1,
	h1 {
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

	.club-list,
	.pending,
	.links {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.club-list li + li,
	.pending li + li,
	.panel {
		border-block-start: var(--rule);
	}

	article,
	.pending li,
	.panel {
		display: grid;
		gap: var(--space-xs);
		padding-block: var(--space-md);
	}

	.meta {
		color: var(--quiet-steel);
		font-size: var(--text-sm);
	}

	.links {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	.stack,
	label {
		display: grid;
		gap: var(--space-3xs);
	}

	.stack {
		gap: var(--space-sm);
		max-width: 36rem;
	}

	label {
		font-size: var(--text-sm);
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
		height: var(--control-height);
		padding-inline: var(--space-xs);
		border: var(--rule-strong);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
	}

	textarea {
		height: auto;
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

	.primary:focus-visible,
	input:focus-visible,
	textarea:focus-visible {
		outline: var(--focus-ring-width) solid var(--club-blue);
		outline-offset: var(--focus-ring-offset);
	}

	.error {
		color: var(--danger);
		font-size: var(--text-sm);
	}

	.status {
		font-size: var(--text-sm);
	}

	@media (max-width: 40rem) {
		.filters {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
