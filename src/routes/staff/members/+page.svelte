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
	$: currentPage = Number(data.listing.page ?? 1);
	$: pageSize = Number(data.listing.pageSize ?? 25);
	$: totalPages = Math.max(1, Math.ceil(data.listing.totalCount / pageSize));

	/** @param {string} weekday @param {string} time */
	function countFor(weekday, time) {
		return counts.get(`${weekday}-${time}`) ?? 0;
	}
	/** @param {{ firstName?: string, lastName?: string, displayName?: string }} member */
	function memberName(member) {
		return [member.firstName, member.lastName].filter(Boolean).join(' ') || member.displayName;
	}

	/** @param {number} page */
	function paginationQuery(page) {
		const parameters = new URLSearchParams();
		if (currentQuery) parameters.set('q', currentQuery);
		parameters.set('page', String(page));
		return parameters.toString();
	}
</script>

<svelte:head><title>Members | Programming Club Team</title></svelte:head>

<section class="members-workspace">
	<header class="page-heading">
		<p class="eyebrow">Programming Club</p>
		<h1>Members</h1>
		<p>Member details and imported schedules are visible only in this console.</p>
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
				<div class="availability-scroll" role="region" aria-label="Scrollable meeting availability">
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
				{#if totalPages > 1}
					<nav class="roster-pagination" aria-label="Roster pages">
						{#if currentPage > 1}
							<a href={resolve(`/staff/members?${paginationQuery(currentPage - 1)}`)}>Previous</a>
						{:else}
							<span aria-disabled="true">Previous</span>
						{/if}
						<p>Page {currentPage} of {totalPages}</p>
						{#if currentPage < totalPages}
							<a href={resolve(`/staff/members?${paginationQuery(currentPage + 1)}`)}>Next</a>
						{:else}
							<span aria-disabled="true">Next</span>
						{/if}
					</nav>
				{/if}
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
		min-width: 0;
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
		overscroll-behavior-inline: contain;
	}
	table {
		width: 100%;
		table-layout: fixed;
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
		min-height: 2.75rem;
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
		overflow-wrap: anywhere;
	}
	.roster-panel a {
		color: var(--club-blue);
		font-weight: 750;
	}
	.roster-pagination {
		display: grid;
		grid-template-columns: minmax(5.5rem, 1fr) auto minmax(5.5rem, 1fr);
		align-items: center;
		gap: 0.75rem;
		margin-top: 1.25rem;
	}
	.roster-pagination a,
	.roster-pagination span {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.75rem;
		padding: 0.5rem 0.75rem;
		border: var(--rule);
		font-weight: 700;
		text-decoration: none;
	}
	.roster-pagination a:last-child,
	.roster-pagination span:last-child {
		justify-self: end;
	}
	.roster-pagination span[aria-disabled='true'] {
		color: var(--color-muted);
		opacity: 0.55;
	}
	.roster-pagination p {
		margin: 0;
		color: var(--color-muted);
		font-size: 0.875rem;
		text-align: center;
	}
	@media (max-width: 720px) {
		.members-workspace {
			gap: 1.25rem;
			padding-block: 1.75rem 3rem;
		}
		.page-heading {
			grid-template-columns: 1fr;
			gap: 1rem;
		}
		.availability-panel,
		.roster-panel {
			padding: 1rem;
		}
		.availability-grid th,
		.availability-grid td {
			min-width: 0;
			padding-inline: 0.25rem;
			font-size: 0.7rem;
		}
		.roster-heading,
		.roster-heading form {
			align-items: stretch;
			flex-direction: column;
		}
		.roster-heading input {
			width: 100%;
		}
		.roster-panel > table {
			table-layout: auto;
		}
		.roster-panel > table thead {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
		}
		.roster-panel > table tbody,
		.roster-panel > table tr,
		.roster-panel > table td {
			display: block;
		}
		.roster-panel > table tr {
			padding-block: 0.75rem;
			border-bottom: var(--rule);
		}
		.roster-panel > table td {
			padding: 0.35rem 0;
			border: 0;
		}
		.roster-panel > table td:first-child a {
			display: inline-flex;
			align-items: center;
			min-height: 2.75rem;
			font-size: 1.05rem;
		}
		.roster-pagination {
			grid-template-columns: 1fr 1fr;
		}
		.roster-pagination p {
			grid-row: 1;
			grid-column: 1 / -1;
		}
	}
</style>
