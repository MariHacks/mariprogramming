<script>
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { getPblById } from '$lib/pbl/catalog.js';
	import { SCIENCE_STEPS } from '$lib/pbl/science-workshop.js';

	/** @type {{ room?: any, unavailable?: boolean }} */
	export let data;
	/** @type {{ error?: string, ok?: boolean, action?: string } | null} */
	export let form = null;

	let confirmingDisband = false;
	let disbandConfirm = '';
	/** @type {string | null} */
	let pendingAction = null;

	$: room = data.room;
	$: stepSources = room?.stepSources ?? {};
	$: submissions = room?.submissions ?? [];
	$: stepIds = [
		...new Set([
			...Object.keys(stepSources).map(Number).filter((n) => Number.isInteger(n) && n >= 0),
			...submissions.map((/** @type {any} */ s) => s.step).filter((n) => Number.isInteger(n))
		])
	].sort((a, b) => a - b);
	$: canConfirmDisband =
		Boolean(room?.code) && disbandConfirm.trim().toUpperCase() === String(room.code).toUpperCase();

	const torontoDate = new Intl.DateTimeFormat('en-CA', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'America/Toronto'
	});

	/** @param {string | null | undefined} value */
	function localDate(value) {
		if (!value) return 'Not recorded';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return 'Not recorded';
		return torontoDate.format(date);
	}

	/** @param {string} pblId */
	function workshopLabel(pblId) {
		const entry = getPblById(pblId);
		if (!entry) return pblId;
		return `${entry.series}: ${entry.title}`;
	}

	/** @param {number} stepId */
	function stepTitle(stepId) {
		const step = SCIENCE_STEPS.find((item) => item.id === stepId);
		return step?.title ? `Step ${stepId + 1}: ${step.title}` : `Step ${stepId + 1}`;
	}

	/** @param {any} member */
	function memberLabel(member) {
		if (member?.email) return member.email;
		if (member?.name) return member.name;
		if (member?.userId) return member.userId;
		return 'Anonymous device';
	}

	/** @param {string} actionKey */
	function enhanceAction(actionKey) {
		return () => {
			pendingAction = actionKey;
			return async ({ update, result }) => {
				await update();
				pendingAction = null;
				if (actionKey === 'disband' && result.type !== 'redirect') {
					confirmingDisband = true;
				}
			};
		};
	}
</script>

<svelte:head>
	<title>{room?.teamName ?? 'PBL team'} | Programming Club Team</title>
</svelte:head>

<section class="staff-page">
	<p class="back">
		<a href={resolve('/staff/pbl', {})}>← All PBL teams</a>
	</p>

	{#if data.unavailable || !room}
		<p class="banner" role="status">Workshop room data is unavailable right now. Try again shortly.</p>
	{:else}
		<header class="page-header">
			<div>
				<p class="workshop">{workshopLabel(room.pblId)}</p>
				<h1>{room.teamName}</h1>
				<p class="lede">
					Code <span class="code">{room.code}</span>
					· Unlocked step {(room.unlockedStep ?? 0) + 1}
					· {room.memberCount} {room.memberCount === 1 ? 'member' : 'members'}
					· Updated {localDate(room.updatedAt)}
				</p>
				<p class="quiet unlocked-note">
					Progress is the team’s unlocked step only. Students pick their own view step locally —
					there is no shared “current step” location.
				</p>
			</div>
		</header>

		{#if form?.error}
			<p class="control-error" role="alert">{form.error}</p>
		{:else if form?.ok}
			<p class="control-ok" role="status">
				{#if form.action === 'ejectMember'}
					Member removed from the team.
				{:else if form.action === 'transferLeader'}
					Team leader updated.
				{:else}
					Saved.
				{/if}
			</p>
		{/if}

		<section class="team-controls" aria-labelledby="team-controls-title">
			<header>
				<h2 id="team-controls-title">Team controls</h2>
				<p>
					Staff override for roster changes. Unlocked step is the only shared progress marker.
				</p>
			</header>

			{#if room.members?.length}
				{#each room.members as member (member.memberId)}
					<div class="control-group">
						<div class="control-copy">
							<h3>
								{memberLabel(member)}
								{#if member.memberId === room.driverMemberId}
									<span class="badge">Leader</span>
								{/if}
							</h3>
							<p>
								{#if member.userId}
									Club account <span class="mono">{member.userId}</span>
								{:else}
									Device member — no club account linked
								{/if}
							</p>
						</div>
						{#if member.memberId === room.driverMemberId}
							<p class="leader-hint">Transfer leadership before ejecting</p>
						{:else}
							<div class="control-actions">
								<form method="POST" action="?/transferLeader" use:enhance={enhanceAction(`transfer-${member.memberId}`)}>
									<input type="hidden" name="memberId" value={member.memberId} />
									<button
										type="submit"
										class="secondary-button"
										disabled={pendingAction !== null}
									>
										{pendingAction === `transfer-${member.memberId}` ? 'Transferring…' : 'Make leader'}
									</button>
								</form>
								<form method="POST" action="?/ejectMember" use:enhance={enhanceAction(`eject-${member.memberId}`)}>
									<input type="hidden" name="memberId" value={member.memberId} />
									<button
										type="submit"
										class="danger-button"
										disabled={pendingAction !== null}
									>
										{pendingAction === `eject-${member.memberId}` ? 'Ejecting…' : 'Eject'}
									</button>
								</form>
							</div>
						{/if}
					</div>
				{/each}
			{:else}
				<p class="empty-note">No member accounts linked yet.</p>
			{/if}

			<div class="control-group danger-control">
				<div class="control-copy">
					<h3 id="disband-title">Disband team</h3>
					<p>
						Permanently deletes this room, members, and stored step work. Students will need a new
						code.
					</p>
				</div>
				{#if !confirmingDisband}
					<button
						type="button"
						class="danger-button"
						disabled={pendingAction !== null}
						on:click={() => {
							confirmingDisband = true;
							disbandConfirm = '';
						}}
					>
						Disband team
					</button>
				{:else}
					<form
						method="POST"
						action="?/disbandTeam"
						class="disband-form"
						aria-labelledby="disband-title"
						use:enhance={enhanceAction('disband')}
					>
						<label for="disband-confirm">
							Type room code <span class="code">{room.code}</span> to confirm
						</label>
						<input
							id="disband-confirm"
							name="confirm"
							type="text"
							autocomplete="off"
							spellcheck="false"
							placeholder={room.code}
							bind:value={disbandConfirm}
							disabled={pendingAction !== null}
						/>
						<div class="control-actions">
							<button
								type="submit"
								class="danger-button"
								disabled={!canConfirmDisband || pendingAction !== null}
							>
								{pendingAction === 'disband' ? 'Disbanding…' : 'Confirm disband'}
							</button>
							<button
								type="button"
								class="secondary-button"
								disabled={pendingAction !== null}
								on:click={() => {
									confirmingDisband = false;
									disbandConfirm = '';
								}}
							>
								Cancel
							</button>
						</div>
					</form>
				{/if}
			</div>
		</section>

		<section class="panel" aria-label="Per-step source">
			<h2>Per-step source</h2>
			<p class="quiet">
				Each unlocked step keeps its own snapshot. Students navigate locally — this is not a shared
				“current step.”
			</p>
			{#if stepIds.length === 0}
				<details class="source" open>
					<summary>Latest shared buffer</summary>
					<pre><code>{room.source || '// Empty program'}</code></pre>
				</details>
			{:else}
				{#each stepIds as stepId (stepId)}
					<details class="source" open={stepId === (room.unlockedStep ?? 0)}>
						<summary>{stepTitle(stepId)}</summary>
						<pre><code>{stepSources[String(stepId)] || room.source || '// Empty program'}</code></pre>
					</details>
				{/each}
			{/if}
		</section>

		<section class="panel" aria-label="Past submissions">
			<h2>Past submissions</h2>
			{#if submissions.length === 0}
				<p class="quiet">No check submissions recorded yet.</p>
			{:else}
				<ul class="subs">
					{#each submissions as sub (sub.id)}
						<li>
							<header>
								<strong>{stepTitle(sub.step)}</strong>
								<span class:pass={sub.passed} class:fail={!sub.passed}>
									{sub.passed ? 'Passed' : 'Failed'}
								</span>
								<span class="when">{localDate(sub.createdAt)}</span>
							</header>
							{#if sub.message}
								<p class="msg">{sub.message}</p>
							{/if}
							<details>
								<summary>Source</summary>
								<pre><code>{sub.source || '// Empty'}</code></pre>
							</details>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</section>

<style>
	.staff-page {
		display: grid;
		gap: 1.25rem;
		max-width: 72rem;
		margin: 0 auto;
		padding: 1.5rem var(--page-gutter) 3rem;
		min-width: 0;
	}

	.back a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		color: var(--club-blue);
		font-size: var(--text-sm);
		font-weight: 700;
		text-decoration: none;
	}

	.back a:hover {
		text-decoration: underline;
	}

	.back a:focus-visible,
	.secondary-button:focus-visible,
	.danger-button:focus-visible,
	.disband-form input:focus-visible,
	.source summary:focus-visible,
	.subs details summary:focus-visible {
		outline: 2px solid var(--club-blue);
		outline-offset: 2px;
	}

	.workshop {
		margin: 0 0 0.35rem;
		color: var(--quiet-steel);
		font-size: 0.82rem;
		font-weight: 700;
	}

	h1 {
		margin: 0;
		font-size: clamp(1.65rem, 2.4vw, 2.1rem);
		line-height: 1.15;
		letter-spacing: -0.02em;
		overflow-wrap: anywhere;
	}

	h2 {
		margin: 0 0 0.5rem;
		font-size: 1.15rem;
	}

	.lede,
	.quiet,
	.banner,
	.msg,
	.empty-note {
		margin: 0;
		color: var(--quiet-steel);
		font-size: var(--text-sm);
		line-height: 1.5;
	}

	.lede {
		margin-top: 0.45rem;
	}

	.unlocked-note {
		margin-top: 0.55rem;
		max-width: 42rem;
	}

	.banner {
		padding: 1rem 1.15rem;
		border: var(--rule-strong);
		background: #fff;
	}

	.control-error,
	.control-ok {
		margin: 0;
		padding: 0.85rem 1rem;
		font-size: var(--text-sm);
		font-weight: 650;
	}

	.control-error {
		border: 1px solid #c73b4a;
		background: #fff5f6;
		color: #9d2936;
	}

	.control-ok {
		border: 1px solid #0f766e;
		background: #f2fbf8;
		color: #0f766e;
	}

	.code,
	.mono,
	.when {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-weight: 700;
		color: var(--midnight);
	}

	.when,
	.mono {
		font-weight: 500;
		color: var(--quiet-steel);
		font-size: 0.78rem;
	}

	.team-controls {
		border: var(--rule-strong);
		background: #fff;
	}

	.team-controls > header {
		padding: 1.15rem 1.35rem;
		border-bottom: var(--rule-strong);
	}

	.team-controls > header h2,
	.team-controls > header p {
		margin: 0;
	}

	.team-controls > header p {
		margin-top: 0.4rem;
		color: var(--quiet-steel);
		font-size: var(--text-sm);
		line-height: 1.45;
		max-width: 48rem;
	}

	.control-group {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.25rem;
		min-height: 5.25rem;
		padding: 1rem 1.35rem;
		border-bottom: var(--rule);
	}

	.control-group:last-child {
		border-bottom: 0;
	}

	.control-copy {
		min-width: 0;
	}

	.control-copy h3,
	.control-copy p {
		margin: 0;
	}

	.control-copy h3 {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 0.55rem;
		align-items: center;
		font-size: 1rem;
		font-weight: 700;
	}

	.control-copy p {
		margin-top: 0.35rem;
		color: var(--quiet-steel);
		font-size: var(--text-sm);
		line-height: 1.4;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: 0.15rem 0.45rem;
		border: var(--rule-strong);
		background: #edf4ff;
		color: var(--club-blue);
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.control-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		justify-content: flex-end;
	}

	.leader-hint {
		margin: 0;
		color: var(--quiet-steel);
		font-size: 0.82rem;
		font-weight: 650;
		text-align: right;
	}

	.empty-note {
		padding: 1.15rem 1.35rem;
	}

	.secondary-button,
	.danger-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.75rem;
		padding: 0.65rem 1rem;
		border: var(--rule-strong);
		background: #fff;
		color: var(--midnight);
		font: inherit;
		font-weight: 750;
		cursor: pointer;
	}

	.secondary-button:hover:not(:disabled) {
		background: #f5f7fb;
	}

	.danger-button {
		border-color: #c73b4a;
		color: #9d2936;
	}

	.danger-button:hover:not(:disabled) {
		background: #fff5f6;
	}

	.secondary-button:disabled,
	.danger-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.disband-form {
		display: grid;
		gap: 0.55rem;
		min-width: min(100%, 22rem);
	}

	.disband-form label {
		font-size: var(--text-sm);
		font-weight: 700;
	}

	.disband-form input {
		min-height: 2.75rem;
		padding: 0.55rem 0.75rem;
		border: var(--rule-strong);
		background: #fff;
		font: inherit;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.panel {
		display: grid;
		gap: 0.65rem;
		padding: 1.1rem 1.2rem;
		border: var(--rule);
		background: #fff;
	}

	.subs {
		display: grid;
		gap: 0.75rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.subs li {
		display: grid;
		gap: 0.35rem;
		padding-bottom: 0.75rem;
		border-bottom: var(--rule);
	}

	.subs li:last-child {
		padding-bottom: 0;
		border-bottom: 0;
	}

	.subs li header {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 0.75rem;
		align-items: baseline;
	}

	.pass {
		color: #0f766e;
		font-weight: 700;
		font-size: 0.85rem;
	}

	.fail {
		color: #9d2936;
		font-weight: 700;
		font-size: 0.85rem;
	}

	.source summary,
	.subs details summary {
		cursor: pointer;
		font-weight: 650;
	}

	pre {
		margin: 0.65rem 0 0;
		padding: 0.85rem 1rem;
		overflow: auto;
		background: #272822;
		color: #f8f8f2;
		font-size: 0.82rem;
		line-height: 1.45;
	}

	@media (max-width: 40rem) {
		.staff-page {
			padding-block: 1.25rem 2.5rem;
			gap: 1rem;
		}

		.control-group {
			align-items: flex-start;
			flex-direction: column;
			gap: 0.85rem;
			padding: 1rem;
		}

		.leader-hint {
			text-align: left;
		}

		.control-actions,
		.control-actions form,
		.control-actions button,
		.danger-control > .danger-button {
			width: 100%;
		}

		.disband-form {
			width: 100%;
		}
	}
</style>
