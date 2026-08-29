<script>
	import { resolve } from '$app/paths';

	/** @type {any} */
	export let data;

	const torontoDate = new Intl.DateTimeFormat('en-CA', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'America/Toronto'
	});

	const statusOptions = Object.freeze([
		['open', 'Open'],
		['resolved', 'Resolved'],
		['dismissed', 'Dismissed'],
		['all', 'All']
	]);

	/** @param {string} value */
	function localDate(value) {
		return torontoDate.format(new Date(value));
	}

	/** @param {string} kind */
	function targetLabel(kind) {
		return kind === 'reply' ? 'Reply' : 'Thread';
	}
</script>

<svelte:head>
	<title>Reports | Programming Club Staff</title>
</svelte:head>

<section class="reports-workspace">
	<header class="page-heading">
		<div>
			<p class="eyebrow">Forum moderation</p>
			<h1>Reports</h1>
			<p class="heading-note">Queued forum reports filed by signed-in students.</p>
		</div>
	</header>

	<form class="filters" method="get" action={resolve('/staff/reports', {})}>
		<label>
			<span>Status</span>
			<select name="status" value={data.statusFilter}>
				{#each statusOptions as option (option[0])}
					<option value={option[0]}>{option[1]}</option>
				{/each}
			</select>
		</label>
		<button type="submit">Apply</button>
	</form>

	{#if data.unavailable}
		<div class="message message-error" role="alert">
			<p>Reports are unavailable right now.</p>
			<a class="inline-action" href={resolve('/staff/reports', {})}>Reload reports</a>
		</div>
	{:else}
		<section class="queue" aria-labelledby="queue-title">
			<header class="queue-heading">
				<div>
					<h2 id="queue-title">
						{data.statusFilter === 'all' ? 'All reports' : `${data.statusFilter} reports`}
					</h2>
					<p>
						{data.reports.length}
						{data.reports.length === 1 ? 'report' : 'reports'}
					</p>
				</div>
			</header>

			{#if data.reports.length === 0}
				<div class="empty-state">
					{#if data.statusFilter === 'open'}
						<p>No open reports.</p>
					{:else}
						<p>No reports match this status.</p>
					{/if}
				</div>
			{:else}
				<div class="report-columns" aria-hidden="true">
					<span>Target</span>
					<span>Reason</span>
					<span>Reporter</span>
					<span>Status</span>
					<span>Filed</span>
					<span>Actions</span>
				</div>
				<ol class="report-list">
					{#each data.reports as report (report.id)}
						<li>
							<div class="report-identity">
								<strong>{targetLabel(report.targetKind)}</strong>
								<span class="mono">{report.targetId}</span>
							</div>
							<div class="report-cell reason">
								<span class="cell-label">Reason</span>
								<span>{report.reason}</span>
							</div>
							<div class="report-cell">
								<span class="cell-label">Reporter</span>
								<span class="mono">{report.reporterUserId}</span>
							</div>
							<div class="report-cell">
								<span class="cell-label">Status</span>
								<span class="status status-{report.status}">{report.status}</span>
							</div>
							<div class="report-cell filed">
								<span class="cell-label">Filed</span>
								<time datetime={report.createdAt}>{localDate(report.createdAt)}</time>
							</div>
							<div class="report-actions">
								{#if report.href}
									<a
										class="open-target"
										href={resolve('/tools/forum/[threadId]', { threadId: report.threadId })}
										aria-label={`Open ${targetLabel(report.targetKind).toLowerCase()}`}
										>Open {targetLabel(report.targetKind).toLowerCase()}</a
									>
								{:else}
									<span class="open-target unavailable">Target missing</span>
								{/if}
								{#if report.status === 'open'}
									<form method="post" class="status-actions">
										<input type="hidden" name="reportId" value={report.id} />
										<button type="submit" formaction="?/resolve">Resolve</button>
										<button type="submit" formaction="?/dismiss">Dismiss</button>
									</form>
								{/if}
							</div>
						</li>
					{/each}
				</ol>
			{/if}
		</section>
	{/if}
</section>

<style>
	.reports-workspace {
		width: 100%;
		padding: clamp(1.25rem, 3vw, 2.5rem) var(--page-gutter) 4rem;
	}

	.page-heading,
	.queue-heading,
	.filters {
		display: flex;
		align-items: center;
	}

	.page-heading {
		justify-content: space-between;
		gap: 1.5rem;
		padding-bottom: 1.25rem;
		border-bottom: var(--rule-strong);
	}

	.page-heading h1 {
		margin-top: 0.2rem;
		font-size: clamp(1.35rem, 2.4vw, 1.75rem);
		letter-spacing: -0.03em;
		line-height: 1.15;
	}

	.heading-note {
		margin-top: 0.45rem;
		color: var(--color-muted);
		font-size: 0.875rem;
	}

	.filters {
		align-items: end;
		gap: 0.65rem;
		padding-block: 1.25rem;
		border-bottom: var(--rule);
	}

	.filters label {
		display: grid;
		gap: 0.35rem;
		color: var(--color-muted);
		font-size: 0.75rem;
		font-weight: 650;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.filters select,
	.filters button {
		min-height: 2.75rem;
		border-radius: 0;
		font: inherit;
		font-size: 0.875rem;
	}

	.filters select {
		min-width: 10rem;
		background: white;
	}

	.filters button {
		padding: 0.65rem 0.9rem;
		border: var(--rule-strong);
		background: white;
		color: var(--midnight);
		font-weight: 650;
		cursor: pointer;
	}

	.message {
		padding: 0.85rem 1rem;
		border-bottom: var(--rule);
		font-size: 0.875rem;
	}

	.message-error {
		border: 1px solid var(--danger);
		background: #fff5f6;
		color: #78142a;
		display: grid;
		gap: 0.5rem;
		justify-items: start;
	}

	.message-error p {
		margin: 0;
	}

	.queue-heading {
		justify-content: space-between;
		gap: 1rem;
		padding: 1.5rem 0 1rem;
	}

	.queue-heading h2 {
		font-size: 1.25rem;
		letter-spacing: -0.02em;
	}

	.queue-heading p {
		margin-top: 0.3rem;
		color: var(--color-muted);
		font-size: 0.875rem;
	}

	.report-columns,
	.report-list li {
		display: grid;
		grid-template-columns:
			minmax(10rem, 1.1fr) minmax(12rem, 1.6fr) minmax(8rem, 0.9fr) minmax(5.5rem, 0.55fr)
			minmax(9rem, 0.9fr) minmax(11rem, 1.1fr);
		gap: 1rem;
		align-items: center;
	}

	.report-actions {
		display: grid;
		gap: 0.45rem;
		justify-items: end;
	}

	.status-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		justify-content: flex-end;
	}

	.status-actions button {
		min-height: 2.75rem;
		padding: 0.45rem 0.75rem;
		border: var(--rule-strong);
		border-radius: 0;
		background: white;
		color: var(--midnight);
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 650;
		cursor: pointer;
	}

	.report-columns {
		padding: 0.65rem 0;
		border-top: var(--rule-strong);
		border-bottom: var(--rule);
		color: var(--color-muted);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}

	.report-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.report-list li {
		min-height: 4.25rem;
		padding-block: 0.7rem;
		border-bottom: var(--rule);
	}

	.report-identity,
	.report-cell {
		display: grid;
		gap: 0.18rem;
		min-width: 0;
	}

	.report-identity strong {
		font-size: 0.875rem;
	}

	.mono,
	.filed time {
		color: var(--color-muted);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		overflow-wrap: anywhere;
	}

	.reason span:last-child {
		font-size: 0.875rem;
	}

	.cell-label {
		display: none;
		color: var(--color-muted);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}

	.status {
		width: fit-content;
		padding: 0.2rem 0.45rem;
		border: 1px solid currentColor;
		color: var(--midnight);
		font-size: 0.6875rem;
		font-weight: 700;
		line-height: 1.3;
		text-transform: uppercase;
	}

	.status-open {
		color: #8a4b08;
	}

	.status-resolved {
		color: #075e41;
	}

	.status-dismissed {
		color: #8d1b32;
	}

	.open-target {
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		min-height: 2.25rem;
		color: var(--club-blue);
		font-size: 0.875rem;
		font-weight: 650;
		text-decoration: none;
	}

	.open-target.unavailable {
		color: var(--color-muted);
		font-weight: 500;
		justify-content: flex-end;
	}

	.empty-state {
		display: grid;
		gap: 0.75rem;
		justify-items: start;
		padding: 2rem 0;
		border-top: var(--rule-strong);
		border-bottom: var(--rule);
		color: var(--color-muted);
	}

	.inline-action {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		color: var(--club-blue);
		font-size: 0.875rem;
		font-weight: 650;
		text-decoration: none;
	}

	.filters button:focus-visible,
	.filters select:focus-visible,
	.open-target:focus-visible,
	.inline-action:focus-visible,
	.status-actions button:focus-visible {
		outline: var(--focus-ring-width) solid var(--color-focus);
		outline-offset: var(--focus-ring-offset);
	}

	@media (max-width: 72rem) {
		.report-columns {
			display: none;
		}

		.report-list li {
			grid-template-columns: minmax(10rem, 1.2fr) minmax(10rem, 1.4fr) minmax(7rem, 0.8fr) minmax(
					11rem,
					1fr
				);
		}

		.filed {
			grid-column: 1 / -1;
			grid-row: 2;
		}
	}

	@media (max-width: 48rem) {
		.report-list li {
			grid-template-columns: 1fr 1fr;
			gap: 1rem;
		}

		.report-identity,
		.reason,
		.filed,
		.report-actions {
			grid-column: 1 / -1;
		}

		.filed {
			grid-row: auto;
		}

		.cell-label {
			display: block;
		}

		.report-actions {
			justify-items: start;
		}

		.status-actions {
			justify-content: flex-start;
		}

		.open-target,
		.open-target.unavailable {
			justify-content: flex-start;
			width: fit-content;
		}
	}
</style>
