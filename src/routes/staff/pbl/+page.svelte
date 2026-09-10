<script>
	import { resolve } from '$app/paths';
	import { getPblById, SCIENCE_PBL_ID } from '$lib/pbl/catalog.js';
	import { SCIENCE_STEP_COUNT } from '$lib/pbl/science-workshop.js';

	/** @type {{ rooms?: any[], unavailable?: boolean }} */
	export let data;

	/** @type {any[]} */
	$: rooms = data.rooms ?? [];

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

	/** @param {any} lastCheck */
	function lastCheckSummary(lastCheck) {
		if (!lastCheck || typeof lastCheck !== 'object') return 'No check yet';
		const step =
			typeof lastCheck.step === 'number' ? `Step ${lastCheck.step + 1}` : 'Latest check';
		const result = lastCheck.passed === true ? 'passed' : lastCheck.passed === false ? 'failed' : '';
		const message = typeof lastCheck.message === 'string' ? lastCheck.message.trim() : '';
		const parts = [step];
		if (result) parts.push(result);
		if (message) parts.push(message);
		return parts.join(' · ');
	}

	/** @param {any} lastCheck */
	function lastCheckTone(lastCheck) {
		if (!lastCheck || typeof lastCheck !== 'object') return 'neutral';
		if (lastCheck.passed === true) return 'pass';
		if (lastCheck.passed === false) return 'fail';
		return 'neutral';
	}

	/** @param {string} pblId */
	function workshopLabel(pblId) {
		const entry = getPblById(pblId);
		if (!entry) return pblId;
		return `${entry.series}: ${entry.title}`;
	}

	/** @param {any} member */
	function memberLabel(member) {
		if (member?.email) return member.email;
		if (member?.name) return member.name;
		if (member?.userId) return member.userId;
		return 'Anonymous device';
	}

	/** @param {any} room */
	function unlockDisplay(room) {
		const unlocked = (room.unlockedStep ?? 0) + 1;
		if (room.pblId === SCIENCE_PBL_ID) {
			return `${unlocked} / ${SCIENCE_STEP_COUNT}`;
		}
		return String(unlocked);
	}
</script>

<svelte:head>
	<title>PBL teams | Programming Club Team</title>
</svelte:head>

<section class="staff-page">
	<header class="page-header">
		<div>
			<h1>PBL teams</h1>
			<p class="lede">
				Rooms by unlocked progress. Open a team for per-step source and submissions — view steps stay
				local to each student.
			</p>
		</div>
		<p class="count" aria-live="polite">
			{rooms.length === 1 ? '1 team' : `${rooms.length} teams`}
		</p>
	</header>

	{#if data.unavailable}
		<p class="banner" role="status">Workshop room data is unavailable right now. Try again shortly.</p>
	{:else if rooms.length === 0}
		<p class="empty" role="status">No PBL teams yet. Rooms show up here after students create one.</p>
	{:else}
		<ul class="roster">
			{#each rooms as room (room.code)}
				<li>
					<a class="roster-row" href={resolve(`/staff/pbl/${room.code}`, {})}>
						<div class="row-main">
							<p class="workshop">{workshopLabel(room.pblId)}</p>
							<div class="title-line">
								<h2>{room.teamName}</h2>
								<span class="code">{room.code}</span>
							</div>
							<p class="meta">
								{room.memberCount} {room.memberCount === 1 ? 'member' : 'members'}
								· Updated {localDate(room.updatedAt)}
							</p>
							{#if room.members?.length}
								<ul class="member-chips" aria-label="Team members">
									{#each room.members as member (member.memberId)}
										<li>{memberLabel(member)}</li>
									{/each}
								</ul>
							{:else}
								<p class="quiet">No member accounts linked yet.</p>
							{/if}
						</div>
						<div class="row-status">
							<span class="unlock-pill">
								<span class="unlock-label">Unlocked</span>
								<span class="unlock-value">{unlockDisplay(room)}</span>
							</span>
							<p class="last-check" data-tone={lastCheckTone(room.lastCheck)}>
								<span class="last-label">Last check</span>
								<span class="last-value">{lastCheckSummary(room.lastCheck)}</span>
							</p>
							<span class="open-cta">Open team</span>
						</div>
					</a>
				</li>
			{/each}
		</ul>
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

	.page-header {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.85rem 1.5rem;
		align-items: end;
	}

	h1 {
		margin: 0;
		font-size: clamp(1.65rem, 2.4vw, 2.1rem);
		line-height: 1.15;
		letter-spacing: -0.02em;
	}

	.lede,
	.count,
	.quiet,
	.empty,
	.banner,
	.meta,
	.workshop {
		margin: 0;
		color: var(--quiet-steel);
		font-size: var(--text-sm);
		line-height: 1.5;
	}

	.lede {
		max-width: 40rem;
		margin-top: 0.45rem;
	}

	.count {
		font-weight: 700;
		color: var(--midnight);
	}

	.banner,
	.empty {
		padding: 1rem 1.15rem;
		border: var(--rule-strong);
		background: #fff;
	}

	.roster {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
		border: var(--rule-strong);
		background: #fff;
	}

	.roster > li + li {
		border-top: var(--rule);
	}

	.roster-row {
		display: grid;
		gap: 1rem;
		padding: 1.1rem 1.25rem;
		color: inherit;
		text-decoration: none;
		min-width: 0;
	}

	.roster-row:hover {
		background: #f7f9fc;
	}

	.roster-row:focus-visible {
		outline: 2px solid var(--club-blue);
		outline-offset: -2px;
	}

	.workshop {
		margin: 0 0 0.3rem;
		font-size: 0.82rem;
		font-weight: 700;
	}

	.title-line {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.75rem;
		align-items: baseline;
	}

	.title-line h2 {
		margin: 0;
		font-size: 1.15rem;
		line-height: 1.25;
		letter-spacing: -0.015em;
		overflow-wrap: anywhere;
	}

	.code {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--midnight);
		letter-spacing: 0.03em;
	}

	.meta {
		margin-top: 0.35rem;
	}

	.member-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin: 0.65rem 0 0;
		padding: 0;
		list-style: none;
	}

	.member-chips li {
		display: inline-flex;
		align-items: center;
		max-width: 100%;
		padding: 0.2rem 0.55rem;
		border: var(--rule);
		background: #f5f7fb;
		color: var(--midnight);
		font-size: 0.78rem;
		font-weight: 650;
		line-height: 1.35;
		overflow-wrap: anywhere;
	}

	.quiet {
		margin-top: 0.55rem;
	}

	.row-status {
		display: grid;
		gap: 0.55rem;
		align-content: start;
		min-width: 0;
	}

	.unlock-pill {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.35rem 0.55rem;
		width: fit-content;
		padding: 0.35rem 0.65rem;
		border: var(--rule-strong);
		background: #edf4ff;
		color: var(--club-blue);
	}

	.unlock-label {
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.unlock-value {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.95rem;
		font-weight: 750;
		letter-spacing: -0.01em;
		color: var(--midnight);
	}

	.last-check {
		display: grid;
		gap: 0.15rem;
		margin: 0;
		min-width: 0;
	}

	.last-label {
		color: var(--quiet-steel);
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.last-value {
		color: var(--midnight);
		font-size: var(--text-sm);
		font-weight: 650;
		line-height: 1.4;
		overflow-wrap: anywhere;
	}

	.last-check[data-tone='pass'] .last-value {
		color: #0f766e;
	}

	.last-check[data-tone='fail'] .last-value {
		color: #9d2936;
	}

	.open-cta {
		color: var(--club-blue);
		font-size: var(--text-sm);
		font-weight: 750;
	}

	.roster-row:hover .open-cta {
		text-decoration: underline;
	}

	@media (min-width: 52rem) {
		.roster-row {
			grid-template-columns: minmax(0, 1.55fr) minmax(12.5rem, 0.9fr);
			gap: 1.25rem 1.75rem;
			align-items: start;
		}

		.row-status {
			justify-items: end;
			text-align: right;
		}

		.last-check {
			justify-items: end;
		}
	}

	@media (max-width: 40rem) {
		.staff-page {
			padding-block: 1.25rem 2.5rem;
			gap: 1rem;
		}

		.roster-row {
			gap: 0.85rem;
			padding: 0.95rem 1rem;
		}

		.member-chips {
			margin-top: 0.5rem;
		}

		.row-status {
			gap: 0.45rem;
		}
	}
</style>
