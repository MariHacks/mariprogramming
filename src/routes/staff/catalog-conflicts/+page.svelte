<script>
	import { resolve } from '$app/paths';
	import { ACADEMIC_TERMS } from '$lib/maritools/term/calendar.js';

	/** @type {any} */
	export let data;

	const torontoDate = new Intl.DateTimeFormat('en-CA', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'America/Toronto'
	});

	/** @param {string} value */
	function localDate(value) {
		return torontoDate.format(new Date(value));
	}

	/** @param {string} termId */
	function termLabel(termId) {
		return ACADEMIC_TERMS.find((term) => term.id === termId)?.name ?? termId;
	}
</script>

<svelte:head>
	<title>Catalog conflicts | Programming Club Team</title>
</svelte:head>

<section class="conflicts-workspace">
	<header class="page-heading">
		<div>
			<p class="eyebrow">MariTools catalog</p>
			<h1>Catalog conflicts</h1>
			<p class="heading-note">
				The first share for a course publishes immediately. Later disagreeing uploads wait here until
				you pick which facts stay public.
			</p>
		</div>
	</header>

	{#if data.unavailable}
		<div class="message message-error" role="alert">
			<p>Catalog conflicts are unavailable right now.</p>
			<a class="inline-action" href={resolve('/staff/catalog-conflicts', {})}>Reload</a>
		</div>
	{:else if data.groups.length === 0}
		<div class="empty-state" role="status">
			<p>No catalog conflicts.</p>
		</div>
	{:else}
		<p class="queue-count">
			{data.groups.length}
			{data.groups.length === 1 ? 'offering' : 'offerings'} need review
		</p>
		<ol class="conflict-list">
			{#each data.groups as group (group.offeringId)}
				<li class="conflict-group">
					<header class="group-heading">
						<strong class="course-code">{group.courseCode}</strong>
						<div>
							<h2>{group.title}</h2>
							<p>
								{group.section} · {group.teacherName} · {termLabel(group.termId)}
							</p>
						</div>
						<span class="peer-count"
							>{group.contributions.length} version{group.contributions.length === 1
								? ''
								: 's'}</span
						>
					</header>
					<div
						class="peer-grid"
						style={`--peer-count: ${Math.max(group.contributions.length, 1)}`}
					>
						{#each group.contributions as contribution (contribution.id)}
							<article class="peer-card" data-conflict-peer={contribution.id}>
								<header>
									<span class="status status-{contribution.status}">{contribution.status}</span>
									<span class="contributor">{contribution.contributorDisplayName}</span>
									<time datetime={contribution.createdAt}>{localDate(contribution.createdAt)}</time>
								</header>

								<section class="fact-block" aria-label="Assessments">
									<h3>Assessments</h3>
									{#if contribution.assessments.length === 0}
										<p class="empty-facts">None listed</p>
									{:else}
										<ul>
											{#each contribution.assessments as row, index (`a-${index}`)}
												<li>
													<strong>{row.title || 'Untitled'}</strong>
													<span
														>{row.weight ? `${row.weight}%` : 'Weight unknown'} · {row.date ||
															'Date missing'}</span
													>
												</li>
											{/each}
										</ul>
									{/if}
								</section>

								<section class="fact-block" aria-label="Books">
									<h3>Books</h3>
									{#if contribution.books.length === 0}
										<p class="empty-facts">None listed</p>
									{:else}
										<ul>
											{#each contribution.books as row, index (`b-${index}`)}
												<li>
													<strong>{row.title || 'Untitled'}</strong>
													<span
														>{row.author || 'Author unknown'}{row.isbn
															? ` · ${row.isbn}`
															: ''}{row.required ? ' · required' : ''}</span
													>
												</li>
											{/each}
										</ul>
									{/if}
								</section>

								<form method="post" action="?/resolve" class="resolve-form">
									<input type="hidden" name="contributionId" value={contribution.id} />
									<button type="submit" data-testid="resolve-conflict">Use these facts</button>
								</form>
							</article>
						{/each}
					</div>
				</li>
			{/each}
		</ol>
	{/if}
</section>

<style>
	.conflicts-workspace {
		padding: 1.5rem var(--page-gutter) 3rem;
	}

	.page-heading {
		margin-bottom: 1.25rem;
	}

	.eyebrow {
		margin: 0 0 0.35rem;
		color: var(--color-muted);
		font-size: 0.75rem;
		font-weight: 650;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		font-size: 1.75rem;
	}

	.heading-note,
	.queue-count {
		margin: 0.5rem 0 0;
		color: var(--color-muted);
		font-size: 0.9375rem;
		max-width: 42rem;
	}

	.message,
	.empty-state {
		padding: 1rem 1.1rem;
		border: var(--rule);
		background: #fff;
	}

	.message-error {
		background: #fff1f1;
		color: #8d1b1b;
	}

	.inline-action {
		display: inline-block;
		margin-top: 0.5rem;
		font-weight: 650;
	}

	.conflict-list {
		display: grid;
		gap: 1.25rem;
		margin: 1rem 0 0;
		padding: 0;
		list-style: none;
	}

	.conflict-group {
		padding: 1rem 1.1rem 1.15rem;
		border: var(--rule-strong);
		background: #fff;
	}

	.group-heading {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.85rem;
		align-items: start;
		margin-bottom: 0.9rem;
	}

	.course-code {
		font-family: var(--font-mono);
		font-size: 0.9375rem;
	}

	.group-heading h2 {
		margin: 0;
		font-size: 1.05rem;
	}

	.group-heading p,
	.peer-count {
		margin: 0.2rem 0 0;
		color: var(--color-muted);
		font-size: 0.8125rem;
	}

	.peer-grid {
		display: grid;
		grid-template-columns: repeat(var(--peer-count), minmax(14rem, 1fr));
		gap: 0.85rem;
	}

	.peer-card {
		display: grid;
		gap: 0.75rem;
		padding: 0.85rem;
		border: var(--rule);
		background: #fafbfc;
	}

	.peer-card header {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem 0.75rem;
		align-items: baseline;
	}

	.status {
		padding: 0.15rem 0.4rem;
		border: 1px solid currentColor;
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.status-published {
		color: #075e41;
	}

	.status-conflict {
		color: #8a4b08;
	}

	.contributor {
		font-size: 0.875rem;
		font-weight: 650;
	}

	.peer-card time {
		margin-left: auto;
		color: var(--color-muted);
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}

	.fact-block h3 {
		margin: 0 0 0.35rem;
		color: var(--color-muted);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}

	.fact-block ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.4rem;
	}

	.fact-block li {
		display: grid;
		gap: 0.1rem;
	}

	.fact-block strong {
		font-size: 0.875rem;
	}

	.fact-block span,
	.empty-facts {
		color: var(--color-muted);
		font-size: 0.8125rem;
	}

	.resolve-form button {
		min-height: 2.75rem;
		width: 100%;
		border: var(--rule-strong);
		background: white;
		font: inherit;
		font-size: 0.875rem;
		font-weight: 650;
		cursor: pointer;
	}

	@media (max-width: 56rem) {
		.peer-grid {
			grid-template-columns: 1fr;
		}

		.group-heading {
			grid-template-columns: 1fr;
		}
	}
</style>
