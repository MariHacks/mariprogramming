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

	/** @param {unknown} structured */
	function factsJson(structured) {
		try {
			return JSON.stringify(structured ?? {}, null, 2);
		} catch {
			return String(structured);
		}
	}

	/** @param {string} sha */
	function shortSha(sha) {
		return sha.length > 12 ? `${sha.slice(0, 8)}…${sha.slice(-4)}` : sha;
	}
</script>

<svelte:head>
	<title>Catalog conflicts | Programming Club Staff</title>
</svelte:head>

<section class="conflicts-workspace">
	<header class="page-heading">
		<div>
			<p class="eyebrow">MariTools catalog</p>
			<h1>Catalog conflicts</h1>
			<p class="heading-note">
				Conflicting course facts stay side by side. The public catalog lists published rows only.
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
			{data.groups.length === 1 ? 'offering' : 'offerings'} with conflicting facts
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
							>{group.contributions.length} peer{group.contributions.length === 1
								? ''
								: 's'}</span
						>
					</header>
					<div
						class="peer-grid"
						style={`--peer-count: ${Math.max(group.contributions.length, 1)}`}
					>
						{#each group.contributions as contribution (contribution.id)}
							<article class="peer-card">
								<header>
									<span class="status">conflict</span>
									<span class="mono" title={contribution.documentSha256}
										>{shortSha(contribution.documentSha256)}</span
									>
								</header>
								<pre class="facts">{factsJson(contribution.structured)}</pre>
								<footer>
									<span class="mono">{contribution.contributorUserId ?? 'anonymous'}</span>
									<time datetime={contribution.createdAt}>{localDate(contribution.createdAt)}</time>
								</footer>
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
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
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
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
		gap: 0.75rem;
	}

	.peer-card {
		display: grid;
		gap: 0.55rem;
		padding: 0.75rem;
		border: var(--rule);
		background: var(--paper, #f7f8fa);
		min-width: 0;
	}

	.peer-card header,
	.peer-card footer {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.4rem 0.75rem;
		font-size: 0.75rem;
	}

	.status {
		font-weight: 700;
		text-transform: lowercase;
		color: #8d1b1b;
	}

	.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		overflow-wrap: anywhere;
	}

	.facts {
		margin: 0;
		padding: 0.65rem 0.7rem;
		overflow: auto;
		border: var(--rule);
		background: #fff;
		color: inherit;
		font: 0.75rem/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	@media (max-width: 40rem) {
		.group-heading {
			grid-template-columns: 1fr;
		}
	}
</style>
