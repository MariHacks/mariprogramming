<script>
	import { applyAction, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ModerationDurationDialog from '$lib/maritools/ModerationDurationDialog.svelte';

	/** @type {any} */
	export let data;

	/** @type {any[]} */
	let reports = data.reports ?? [];
	$: reports = data.reports ?? [];

	/** @type {{ kind: 'mute' | 'ban', report: any } | null} */
	let durationPrompt = null;

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
	function targetKindLabel(kind) {
		return kind === 'reply' ? 'Reply' : 'Thread';
	}

	/** @param {string} filter */
	function queueTitle(filter) {
		if (filter === 'all') return 'All reports';
		if (filter === 'open') return 'Open reports';
		if (filter === 'resolved') return 'Resolved reports';
		if (filter === 'dismissed') return 'Dismissed reports';
		return 'Reports';
	}

	/** @param {'mute' | 'ban'} kind @param {any} report */
	function openDurationPrompt(kind, report) {
		durationPrompt = { kind, report };
	}

	function closeDurationPrompt() {
		durationPrompt = null;
	}

	/** Soft-submit: Resolve/Dismiss leave the open queue; moderation keeps the row. */
	function enhanceQueue() {
		return async (
			/** @type {{ formData: FormData, result: import('@sveltejs/kit').ActionResult, action: URL }} */ {
				formData,
				result,
				action
			}
		) => {
			if (result.type !== 'success' && result.type !== 'failure') return;
			if (result.type === 'success') {
				durationPrompt = null;
				const reportId = String(formData.get('reportId') ?? '');
				const actionPath = String(action?.search ?? action ?? '');
				const closesTicket =
					actionPath.includes('resolve') ||
					actionPath.includes('dismiss') ||
					(result.data &&
						typeof result.data === 'object' &&
						(result.data.status === 'resolved' || result.data.status === 'dismissed'));
				if (reportId && closesTicket) {
					reports = reports.filter((row) => row.id !== reportId);
				}
			}
			try {
				await applyAction(result);
			} catch {
				// Local queue already reflects the committed change.
			}
			if (result.type === 'success') {
				try {
					await invalidateAll();
				} catch {
					// Soft update already applied when the ticket closed.
				}
			}
		};
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
			<p class="heading-note">
				Open reports stay open after Lock, Mute, or Ban. Resolve or Dismiss closes the ticket.
			</p>
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
					<h2 id="queue-title">{queueTitle(data.statusFilter)}</h2>
					<p>
						{reports.length}
						{reports.length === 1 ? 'report' : 'reports'}
					</p>
				</div>
			</header>

			{#if reports.length === 0}
				<div class="empty-state">
					{#if data.statusFilter === 'open'}
						<p>No open reports.</p>
					{:else}
						<p>No reports match this status.</p>
					{/if}
				</div>
			{:else}
				<div class="table-scroll">
					<table class="report-table">
						<thead>
							<tr>
								<th scope="col">Target</th>
								<th scope="col">Reason</th>
								<th scope="col">Reporter</th>
								<th scope="col">Status</th>
								<th scope="col">Filed</th>
								<th scope="col">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each reports as report (report.id)}
								<tr data-report-reason={report.reason} data-report-id={report.id}>
									<td>
										<div class="target-cell">
											<span class="kind">{targetKindLabel(report.targetKind)}</span>
											{#if report.href && report.threadId}
												<a
													class="target-title"
													href={resolve('/tools/forum/[threadId]', {
														threadId: report.threadId
													})}>{report.targetTitle}</a
												>
											{:else}
												<span class="target-title">{report.targetTitle}</span>
											{/if}
											{#if report.subjectProfileHref}
												<a class="subject" href={report.subjectProfileHref}
													>by {report.subjectDisplayName || 'Student'}</a
												>
											{:else if report.subjectDisplayName}
												<span class="subject">by {report.subjectDisplayName}</span>
											{/if}
										</div>
									</td>
									<td>{report.reason}</td>
									<td>
										<a class="person-link" href={report.reporterProfileHref}
											>{report.reporterDisplayName}</a
										>
									</td>
									<td>
										<span class="status status-{report.status}">{report.status}</span>
									</td>
									<td>
										<time datetime={report.createdAt}>{localDate(report.createdAt)}</time>
									</td>
									<td>
										<div class="report-actions">
											{#if report.href && report.threadId}
												<a
													class="text-action"
													href={resolve('/tools/forum/[threadId]', {
														threadId: report.threadId
													})}
													aria-label={`Open ${targetKindLabel(report.targetKind).toLowerCase()}`}
													>Open</a
												>
											{:else}
												<span class="text-action unavailable">Missing</span>
											{/if}
											{#if report.status === 'open'}
												<div class="action-groups">
													<form method="post" class="danger-actions" use:enhance={enhanceQueue}>
														<input type="hidden" name="reportId" value={report.id} />
														<input type="hidden" name="threadId" value={report.threadId ?? ''} />
														<input
															type="hidden"
															name="subjectUserId"
															value={report.subjectUserId ?? ''}
														/>
														{#if report.threadId}
															<button type="submit" class="danger-button" formaction="?/lockThread"
																>Lock</button
															>
														{/if}
														{#if report.subjectUserId}
															<button
																type="button"
																class="danger-button"
																on:click={() => openDurationPrompt('mute', report)}
																>Mute</button
															>
															<button
																type="button"
																class="danger-button"
																on:click={() => openDurationPrompt('ban', report)}
																>Ban</button
															>
														{/if}
													</form>
													<form method="post" class="ticket-actions" use:enhance={enhanceQueue}>
														<input type="hidden" name="reportId" value={report.id} />
														<button type="submit" formaction="?/resolve">Resolve</button>
														<button type="submit" formaction="?/dismiss">Dismiss</button>
													</form>
												</div>
											{/if}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	{/if}
</section>

{#if durationPrompt}
	<ModerationDurationDialog
		kind={durationPrompt.kind}
		idPrefix={`${durationPrompt.kind}-${durationPrompt.report.id}`}
		formaction={durationPrompt.kind === 'mute' ? '?/muteAuthor' : '?/banAuthor'}
		title={durationPrompt.kind === 'mute' ? 'Mute duration' : 'Ban duration'}
		confirmLabel={durationPrompt.kind === 'mute' ? 'Confirm mute' : 'Confirm ban'}
		hiddenFields={{
			reportId: durationPrompt.report.id,
			threadId: durationPrompt.report.threadId ?? '',
			subjectUserId: durationPrompt.report.subjectUserId ?? ''
		}}
		enhance={enhanceQueue}
		onCancel={closeDurationPrompt}
	/>
{/if}

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
		max-width: 40rem;
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

	.table-scroll {
		width: 100%;
		overflow-x: auto;
		border-top: var(--rule-strong);
	}

	.report-table {
		width: 100%;
		min-width: 56rem;
		border-collapse: collapse;
		table-layout: fixed;
	}

	.report-table th,
	.report-table td {
		padding: 0.85rem 0.75rem;
		border-bottom: var(--rule);
		text-align: left;
		vertical-align: middle;
	}

	.report-table th:first-child,
	.report-table td:first-child {
		padding-left: 0;
	}

	.report-table th:last-child,
	.report-table td:last-child {
		padding-right: 0;
	}

	.report-table th {
		color: var(--color-muted);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}

	.report-table th:nth-child(1),
	.report-table td:nth-child(1) {
		width: 22%;
	}

	.report-table th:nth-child(2),
	.report-table td:nth-child(2) {
		width: 20%;
	}

	.report-table th:nth-child(3),
	.report-table td:nth-child(3) {
		width: 12%;
	}

	.report-table th:nth-child(4),
	.report-table td:nth-child(4) {
		width: 9%;
	}

	.report-table th:nth-child(5),
	.report-table td:nth-child(5) {
		width: 14%;
	}

	.report-table th:nth-child(6),
	.report-table td:nth-child(6) {
		width: 23%;
	}

	.target-cell {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}

	.kind {
		color: var(--color-muted);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.target-title {
		color: inherit;
		font-size: 0.875rem;
		font-weight: 650;
		text-decoration: none;
		overflow-wrap: anywhere;
	}

	a.target-title {
		color: var(--club-blue);
	}

	.subject {
		color: var(--color-muted);
		font-size: 0.75rem;
		text-decoration: none;
	}

	a.subject {
		color: var(--club-blue);
	}

	.person-link {
		color: var(--club-blue);
		font-size: 0.875rem;
		font-weight: 650;
		text-decoration: none;
	}

	.report-table time {
		color: var(--color-muted);
		font-family: var(--font-mono);
		font-size: 0.75rem;
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

	.report-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 0.35rem;
	}

	.action-groups {
		display: grid;
		gap: 0.55rem;
		justify-items: end;
		min-width: min(100%, 22rem);
	}

	.danger-actions,
	.ticket-actions {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 0.35rem;
	}

	.danger-actions {
		padding: 0.4rem 0.45rem;
		border: 1px solid #c73b4a;
		background: #fff5f6;
	}

	.ticket-actions {
		padding-top: 0.35rem;
		border-top: var(--rule-strong);
	}

	.duration-block {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.35rem;
		border: var(--rule);
		background: #f7f9fb;
	}

	.duration-block-danger {
		border-color: #e8b0b7;
		background: #fff;
	}

	.danger-button,
	.ticket-actions button,
	.text-action {
		min-height: 2.25rem;
		padding: 0.35rem 0.55rem;
		border: var(--rule-strong);
		border-radius: 0;
		background: white;
		color: var(--midnight);
		font: inherit;
		font-size: 0.75rem;
		font-weight: 650;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
	}

	.danger-button {
		border-color: #c73b4a;
		background: #c73b4a;
		color: white;
	}

	.danger-button:hover {
		background: #a82f3c;
		border-color: #a82f3c;
	}

	.text-action {
		border-color: transparent;
		color: var(--club-blue);
		padding-inline: 0.35rem;
	}

	.text-action.unavailable {
		color: var(--color-muted);
		font-weight: 500;
		cursor: default;
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
	.person-link:focus-visible,
	.target-title:focus-visible,
	.subject:focus-visible,
	.text-action:focus-visible,
	.inline-action:focus-visible,
	.danger-button:focus-visible,
	.ticket-actions button:focus-visible {
		outline: var(--focus-ring-width) solid var(--color-focus);
		outline-offset: var(--focus-ring-offset);
	}

	@media (max-width: 48rem) {
		.report-table {
			min-width: 40rem;
		}
	}
</style>
