<script>
	import { resolve } from '$app/paths';
	import { getPblById } from '$lib/pbl/catalog.js';

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
</script>

<svelte:head>
	<title>PBL teams | Programming Club Team</title>
</svelte:head>

<section class="staff-page">
	<header class="page-header">
		<div>
			<p class="eyebrow">Workshops</p>
			<h1>PBL teams</h1>
			<p class="lede">
				Live workshop rooms by unlocked progress. Open a team to inspect per-step code and past
				submissions — member view steps stay local to each student.
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
		<ul class="team-list">
			{#each rooms as room (room.code)}
				<li class="team-card">
					<header class="team-header">
						<div>
							<p class="workshop">{workshopLabel(room.pblId)}</p>
							<h2>
								<a href={resolve(`/staff/pbl/${room.code}`, {})}>{room.teamName}</a>
							</h2>
							<p class="meta">
								Code <span class="code">{room.code}</span>
								· {room.memberCount} {room.memberCount === 1 ? 'member' : 'members'}
								· Updated {localDate(room.updatedAt)}
							</p>
						</div>
						<dl class="progress">
							<div>
								<dt>Unlocked step</dt>
								<dd>{(room.unlockedStep ?? 0) + 1}</dd>
							</div>
							<div class="wide">
								<dt>Last check</dt>
								<dd>{lastCheckSummary(room.lastCheck)}</dd>
							</div>
						</dl>
					</header>

					<section class="members" aria-label="Team members">
						<h3>Members</h3>
						{#if room.members?.length}
							<ul>
								{#each room.members as member (member.memberId)}
									<li>
										<span class="member-email">{memberLabel(member)}</span>
										{#if member.userId}
											<span class="member-id">{member.userId}</span>
										{/if}
									</li>
								{/each}
							</ul>
						{:else}
							<p class="quiet">No member accounts linked yet.</p>
						{/if}
					</section>

					<p class="detail-link">
						<a href={resolve(`/staff/pbl/${room.code}`, {})}>View step sources &amp; submissions</a>
					</p>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.staff-page {
		display: grid;
		gap: 1.5rem;
		padding: 1.5rem var(--page-gutter) 2.5rem;
	}

	.page-header {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 1rem 1.5rem;
		align-items: end;
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
		font-size: clamp(1.6rem, 2vw, 2rem);
	}

	.lede,
	.count,
	.quiet,
	.empty,
	.banner,
	.meta,
	.workshop,
	.detail-link {
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
		font-weight: 650;
		color: var(--midnight);
	}

	.banner,
	.empty {
		padding: 1rem 1.15rem;
		border: var(--rule);
		border-radius: 0.45rem;
		background: #fff;
	}

	.team-list {
		display: grid;
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.team-card {
		display: grid;
		gap: 1rem;
		padding: 1.15rem 1.25rem 1.25rem;
		border: var(--rule);
		border-radius: 0.5rem;
		background: #fff;
	}

	.team-header {
		display: grid;
		gap: 1rem;
	}

	.team-header h2 {
		margin: 0.2rem 0 0.35rem;
		font-size: 1.25rem;
	}

	.team-header h2 a {
		color: inherit;
		text-decoration: none;
	}

	.team-header h2 a:hover,
	.detail-link a:hover {
		text-decoration: underline;
	}

	.code {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-weight: 700;
		color: var(--midnight);
	}

	.progress {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, max-content));
		gap: 0.65rem 1.25rem;
		margin: 0;
	}

	.progress div {
		display: grid;
		gap: 0.15rem;
	}

	.progress .wide {
		grid-column: 1 / -1;
	}

	.progress dt {
		color: var(--quiet-steel);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}

	.progress dd {
		margin: 0;
		font-weight: 650;
	}

	.members h3 {
		margin: 0 0 0.45rem;
		font-size: 0.95rem;
	}

	.members ul {
		display: grid;
		gap: 0.35rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.members li {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.75rem;
		align-items: baseline;
	}

	.member-email {
		font-weight: 650;
	}

	.member-id {
		color: var(--quiet-steel);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.78rem;
	}

	.detail-link a {
		font-weight: 650;
		color: var(--club-blue, #0b4cf4);
	}

	@media (min-width: 56rem) {
		.team-header {
			grid-template-columns: minmax(0, 1.4fr) minmax(14rem, 1fr);
			align-items: start;
		}
	}
</style>
