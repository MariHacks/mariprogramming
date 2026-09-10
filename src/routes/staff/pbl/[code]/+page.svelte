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
				<p class="eyebrow">{workshopLabel(room.pblId)}</p>
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

		<section class="panel" aria-label="Members">
			<h2>Members</h2>
			<p class="quiet">
				Staff can eject anyone except the current leader, transfer leadership, then remove the old
				leader if needed.
			</p>
			{#if room.members?.length}
				<ul class="members">
					{#each room.members as member (member.memberId)}
						<li>
							<div class="member-main">
								<span class="member-email">{memberLabel(member)}</span>
								{#if member.memberId === room.driverMemberId}
									<span class="badge">Leader</span>
								{/if}
								{#if member.userId}
									<span class="member-id">{member.userId}</span>
								{/if}
							</div>
							<div class="member-actions">
								{#if member.memberId !== room.driverMemberId}
									<form method="POST" action="?/transferLeader" use:enhance>
										<input type="hidden" name="memberId" value={member.memberId} />
										<button type="submit" class="secondary-button">Make leader</button>
									</form>
									<form method="POST" action="?/ejectMember" use:enhance>
										<input type="hidden" name="memberId" value={member.memberId} />
										<button type="submit" class="danger-button">Eject</button>
									</form>
								{:else}
									<span class="quiet leader-hint">Transfer leadership before ejecting</span>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="quiet">No member accounts linked yet.</p>
			{/if}
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

		<section class="panel danger-panel" aria-labelledby="disband-title">
			<h2 id="disband-title">Disband team</h2>
			<p class="quiet">
				Permanently deletes this room, members, and stored step work. Students will need a new code.
			</p>
			{#if !confirmingDisband}
				<button type="button" class="danger-button" on:click={() => (confirmingDisband = true)}>
					Disband team
				</button>
			{:else}
				<form
					method="POST"
					action="?/disbandTeam"
					class="disband-form"
					use:enhance={() => {
						return async ({ update, result }) => {
							await update();
							if (result.type !== 'redirect') {
								confirmingDisband = true;
							}
						};
					}}
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
					/>
					<div class="disband-actions">
						<button type="submit" class="danger-button" disabled={!canConfirmDisband}>
							Confirm disband
						</button>
						<button
							type="button"
							class="secondary-button"
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
		</section>
	{/if}
</section>

<style>
	.staff-page {
		display: grid;
		gap: 1.25rem;
		padding: 1.5rem var(--page-gutter) 2.5rem;
	}

	.back a {
		color: var(--quiet-steel);
		font-size: var(--text-sm);
		font-weight: 650;
		text-decoration: none;
	}

	.back a:hover {
		text-decoration: underline;
	}

	.eyebrow {
		margin: 0 0 0.35rem;
		color: var(--quiet-steel);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		font-size: clamp(1.5rem, 2vw, 1.9rem);
	}

	h2 {
		margin: 0 0 0.5rem;
		font-size: 1.05rem;
	}

	.lede,
	.quiet,
	.banner,
	.msg {
		margin: 0;
		color: var(--quiet-steel);
		font-size: var(--text-sm);
		line-height: 1.5;
	}

	.lede {
		margin-top: 0.4rem;
	}

	.unlocked-note {
		margin-top: 0.55rem;
		max-width: 40rem;
	}

	.banner {
		padding: 1rem 1.15rem;
		border: var(--rule);
		border-radius: 0.45rem;
		background: #fff;
	}

	.control-error,
	.control-ok {
		margin: 0;
		padding: 0.75rem 1rem;
		border-radius: 0.45rem;
		font-size: var(--text-sm);
		font-weight: 650;
	}

	.control-error {
		border: 1px solid #f3c1bb;
		background: #fff5f4;
		color: #b42318;
	}

	.control-ok {
		border: 1px solid #b7e1d8;
		background: #f2fbf8;
		color: #0f766e;
	}

	.code {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-weight: 700;
		color: var(--midnight);
	}

	.panel {
		display: grid;
		gap: 0.65rem;
		padding: 1.1rem 1.2rem;
		border: var(--rule);
		border-radius: 0.5rem;
		background: #fff;
	}

	.danger-panel {
		border-color: #f3c1bb;
	}

	.members,
	.subs {
		display: grid;
		gap: 0.55rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.members li {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem 1rem;
		align-items: center;
		justify-content: space-between;
		padding: 0.45rem 0;
		border-bottom: var(--rule);
	}

	.members li:last-child {
		border-bottom: 0;
		padding-bottom: 0;
	}

	.member-main {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.65rem;
		align-items: baseline;
		min-width: 0;
	}

	.member-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}

	.member-email {
		font-weight: 650;
	}

	.badge {
		display: inline-block;
		padding: 0.1rem 0.4rem;
		border-radius: 999px;
		background: #e8eefc;
		color: #0b4cf4;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	.member-id,
	.when {
		color: var(--quiet-steel);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.78rem;
	}

	.leader-hint {
		font-size: 0.78rem;
	}

	.secondary-button,
	.danger-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.5rem;
		padding: 0.35rem 0.8rem;
		border-radius: 0.4rem;
		border: var(--rule);
		background: #fff;
		color: var(--midnight);
		font: inherit;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
	}

	.secondary-button:hover {
		background: #f5f7fb;
	}

	.danger-button {
		border-color: #f3c1bb;
		background: #fff5f4;
		color: #b42318;
	}

	.danger-button:hover:not(:disabled) {
		background: #ffe8e5;
	}

	.danger-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.disband-form {
		display: grid;
		gap: 0.55rem;
		max-width: 24rem;
	}

	.disband-form label {
		font-size: var(--text-sm);
		font-weight: 650;
	}

	.disband-form input {
		min-height: 2.5rem;
		padding: 0.4rem 0.65rem;
		border: var(--rule);
		border-radius: 0.4rem;
		font: inherit;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.disband-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.subs li {
		display: grid;
		gap: 0.35rem;
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
		color: #b42318;
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
		border-radius: 0.4rem;
		background: #272822;
		color: #f8f8f2;
		font-size: 0.82rem;
		line-height: 1.45;
	}
</style>
