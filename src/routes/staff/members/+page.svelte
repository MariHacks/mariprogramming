<script>
	import { resolve } from '$app/paths';
	export let data;
	const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
	/** @typedef {{ weekday: string, time: string, freeCount: number }} AvailabilityCell */
	/** @param {AvailabilityCell[]} cells */
	const uniqueTimes = (cells) => [...new Set(cells.map((cell) => cell.time))];
	/** @param {AvailabilityCell[]} cells */
	const countMap = (cells) =>
		new Map(cells.map((cell) => [`${cell.weekday}-${cell.time}`, cell.freeCount]));
	$: times = uniqueTimes(data.availability.cells);
	$: counts = countMap(data.availability.cells);
	$: currentQuery = data.listing.query ?? '';

	/** @param {string} weekday @param {string} time */
	function countFor(weekday, time) {
		return counts.get(`${weekday}-${time}`) ?? 0;
	}
	/** @param {{ firstName?: string, lastName?: string, displayName?: string }} member */
	function memberName(member) {
		return [member.firstName, member.lastName].filter(Boolean).join(' ') || member.displayName;
	}
</script>

<svelte:head><title>Members | Programming Club Staff</title></svelte:head>

<section class="members-workspace">
	<header class="page-heading">
		<p class="eyebrow">Programming Club</p>
		<h1>Members</h1>
		<p>Only club staff can view member details and imported schedules.</p>
	</header>
	{#if data.unavailable}
		<p role="alert">Member records are unavailable right now.</p>
	{:else}
		<section class="availability-panel" aria-labelledby="availability-title">
			<h2 id="availability-title">Class-free meeting times</h2>
			<p>
				{data.availability.denominator} valid imported {data.availability.denominator === 1
					? 'schedule'
					: 'schedules'}. {data.availability.invalidScheduleCount} imported {data.availability
					.invalidScheduleCount === 1
					? 'schedule needs'
					: 'schedules need'} a valid import.
			</p>
			{#if data.availability.denominator === 0}<p>No valid imported schedules yet.</p>{:else}
				<div class="availability-scroll">
					<table class="availability-grid" aria-label="Members without class at each time">
						<thead
							><tr
								><th>Time</th>{#each weekdays as day (day)}<th>{day}</th>{/each}</tr
							></thead
						>
						<tbody
							>{#each times as time (time)}<tr
									><th>{time}</th>{#each weekdays as day (day)}
										{@const count = countFor(day, time)}
										<td class:best={count === data.availability.denominator}>{count}</td>
									{/each}</tr
								>{/each}</tbody
						>
					</table>
				</div>
			{/if}
		</section>
		<section class="roster-panel" aria-labelledby="roster-title">
			<div class="roster-heading">
				<div>
					<h2 id="roster-title">Roster</h2>
					<p>{data.listing.totalCount} {data.listing.totalCount === 1 ? 'member' : 'members'}</p>
				</div>
				<form method="GET">
					<label
						><span>Search members</span><input
							name="q"
							value={currentQuery}
							placeholder="Name, email, program, or student number"
						/></label
					><button type="submit">Search</button>
				</form>
			</div>
			{#if data.listing.rows.length === 0}
				<p>No club members have joined yet.</p>
			{:else}
				<table>
					<thead><tr><th>Name</th><th>Program</th><th>Schedule</th></tr></thead><tbody>
						{#each data.listing.rows as member (member.userId)}
							<tr
								><td
									><a href={resolve('/staff/members/[userId]', { userId: member.userId })}
										>{memberName(member)}</a
									></td
								><td>{member.program}</td><td
									>{member.scheduleSharedAt ? 'Imported' : 'Not imported'}</td
								></tr
							>
						{/each}
					</tbody>
				</table>
			{/if}
		</section>
	{/if}
</section>

<style>
	.members-workspace {
		display: grid;
		gap: 2rem;
		max-width: 88rem;
		margin: 0 auto;
		padding: 3rem var(--page-gutter) 5rem;
	}
	.page-heading {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(18rem, 34rem);
		align-items: end;
		gap: 2rem;
		padding-bottom: 1.5rem;
		border-bottom: var(--rule-strong);
	}
	.page-heading h1 {
		margin: 0;
		font-size: clamp(2.5rem, 6vw, 5.5rem);
		line-height: 0.88;
		letter-spacing: -0.055em;
	}
	.page-heading p:last-child {
		margin: 0;
		color: var(--color-muted);
	}
	.eyebrow {
		margin: 0 0 0.75rem;
		color: var(--club-blue);
		font-size: 0.75rem;
		font-weight: 750;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.availability-panel,
	.roster-panel {
		padding: 1.5rem;
		border: var(--rule-strong);
		background: #fff;
	}
	.availability-panel h2,
	.roster-panel h2 {
		margin: 0;
		font-size: 1.5rem;
	}
	.availability-scroll {
		margin-top: 1.25rem;
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	.availability-grid th,
	.availability-grid td {
		min-width: 4.25rem;
		padding: 0.42rem 0.5rem;
		border: 1px solid var(--color-border);
		text-align: center;
		font-size: 0.78rem;
		font-variant-numeric: tabular-nums;
	}
	.availability-grid thead th,
	.availability-grid tbody th {
		background: var(--paper);
		font-weight: 700;
	}
	.availability-grid td {
		background: #edf4ff;
	}
	.availability-grid td.best {
		background: var(--club-blue);
		color: #fff;
		font-weight: 800;
	}
	.roster-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}
	.roster-heading p {
		margin: 0.25rem 0 0;
		color: var(--color-muted);
	}
	.roster-heading form {
		display: flex;
		align-items: end;
		gap: 0.5rem;
	}
	.roster-heading label {
		display: grid;
		gap: 0.25rem;
		font-size: 0.75rem;
		font-weight: 700;
	}
	.roster-heading input,
	.roster-heading button {
		min-height: 2.6rem;
		border: var(--rule);
		border-radius: 0;
		font: inherit;
	}
	.roster-heading input {
		width: min(24rem, 40vw);
		padding: 0 0.75rem;
	}
	.roster-heading button {
		padding: 0 1rem;
		background: var(--midnight);
		color: #fff;
		cursor: pointer;
	}
	.roster-panel > table th,
	.roster-panel > table td {
		padding: 0.9rem 0.65rem;
		border-bottom: var(--rule);
		text-align: left;
	}
	.roster-panel a {
		color: var(--club-blue);
		font-weight: 750;
	}
	@media (max-width: 720px) {
		.page-heading {
			grid-template-columns: 1fr;
		}
		.roster-heading,
		.roster-heading form {
			align-items: stretch;
			flex-direction: column;
		}
		.roster-heading input {
			width: 100%;
		}
	}
</style>
