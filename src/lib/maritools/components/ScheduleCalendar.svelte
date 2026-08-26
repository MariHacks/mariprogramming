<script>
	import { layoutTimedMeetings, gridHourLabels } from '$lib/maritools/schedule/calendarLayout.js';

	/** @type {{ date: string, weekday: string, dayNumber: number, isToday: boolean, isNoClass: boolean, outOfTerm: boolean, meetings: import('$lib/maritools/schedule/timetable.js').PlacedMeeting[], overlap: boolean }[]} */
	export let grid = [];

	/** @type {string[]} */
	const hourLabels = gridHourLabels();

	/** @param {number} index */
	function eventTone(index) {
		return ['event-blue', 'event-ink', 'event-slate', 'event-pale', 'event-line'][index % 5];
	}
</script>

<div class="calendar-frame" aria-label="Weekly course schedule">
	<div class="calendar-corner"><span>EST</span></div>
	{#each grid as column (column.date)}
		<div class="day-head" class:is-today={column.isToday} class:is-no-class={column.isNoClass}>
			<span>{column.weekday}</span><strong>{column.dayNumber}</strong>
			{#if column.isToday}<i>Today</i>{/if}
			{#if column.isNoClass && !column.outOfTerm}<i class="muted">No class</i>{/if}
		</div>
	{/each}
	<div class="time-rail">
		{#each hourLabels as label, index (label)}
			<span style={`--row:${index}`}>{label}</span>
		{/each}
	</div>
	{#each grid as column (column.date)}
		<div
			class="day-column"
			class:today-column={column.isToday}
			class:no-class-column={column.isNoClass}
		>
			{#each layoutTimedMeetings(column.meetings) as meeting, meetingIndex (meeting.courseCode + meeting.startTime)}
				<article
					class="event {eventTone(meetingIndex)}"
					class:conflict={meeting.conflict}
					style={`--start:${meeting.startHours}; --duration:${meeting.durationHours}; --lane:${meeting.lane}; --lanes:${meeting.lanes}`}
				>
					{#if meeting.conflict}<b>Conflict</b>{/if}
					<strong>{meeting.title}</strong>
					<span>{meeting.courseCode}</span>
					<small>{meeting.startTime}–{meeting.endTime}<br />{meeting.classroom}</small>
				</article>
			{/each}
		</div>
	{/each}
</div>

<style>
	.calendar-frame {
		--hour-h: 58px;
		display: grid;
		grid-template-columns: 42px repeat(5, minmax(0, 1fr));
		grid-template-rows: auto repeat(11, var(--hour-h));
		position: relative;
		min-height: 42rem;
		border: 1px solid rgb(var(--midnight-rgb) / 16%);
		background: #fff;
	}

	.calendar-corner,
	.day-head,
	.time-rail span {
		border-bottom: 1px solid rgb(var(--midnight-rgb) / 12%);
		background: #f7f9fc;
		color: var(--quiet-steel);
		font-size: 0.625rem;
		font-weight: 650;
	}

	.calendar-corner {
		display: grid;
		place-items: center;
	}

	.day-head {
		display: grid;
		align-content: center;
		justify-items: center;
		padding: 0.45rem 0.25rem;
		gap: 0.1rem;
		border-left: 1px solid rgb(var(--midnight-rgb) / 12%);
	}

	.day-head strong {
		color: var(--midnight);
		font-size: 1rem;
	}

	.day-head.is-today {
		box-shadow: inset 0 -2px 0 var(--club-blue);
	}

	.day-head.is-no-class {
		background: #f1f3f6;
	}

	.day-head i {
		color: var(--club-blue);
		font-size: 0.5625rem;
		font-style: normal;
		font-weight: 700;
		text-transform: uppercase;
	}

	.day-head i.muted {
		color: var(--quiet-steel);
	}

	.time-rail {
		display: contents;
	}

	.time-rail span {
		grid-column: 1;
		grid-row: calc(var(--row) + 2);
		display: grid;
		align-items: start;
		padding-top: 0.35rem;
		padding-right: 0.35rem;
		text-align: right;
	}

	.day-column {
		position: relative;
		grid-row: 2 / -1;
		border-left: 1px solid rgb(var(--midnight-rgb) / 10%);
		background-image: repeating-linear-gradient(
			to bottom,
			transparent 0,
			transparent calc(var(--hour-h) - 1px),
			rgb(var(--midnight-rgb) / 8%) calc(var(--hour-h) - 1px),
			rgb(var(--midnight-rgb) / 8%) var(--hour-h)
		);
	}

	.no-class-column {
		background-color: #f8f9fb;
		background-image: repeating-linear-gradient(
			to bottom,
			transparent 0,
			transparent calc(var(--hour-h) - 1px),
			rgb(var(--midnight-rgb) / 5%) calc(var(--hour-h) - 1px),
			rgb(var(--midnight-rgb) / 5%) var(--hour-h)
		);
	}

	.event {
		position: absolute;
		z-index: 2;
		top: calc(var(--start) * var(--hour-h) + 2px);
		left: calc((100% / var(--lanes)) * var(--lane) + 3px);
		width: calc(100% / var(--lanes) - 5px);
		height: calc(var(--duration) * var(--hour-h) - 4px);
		min-height: 2.375rem;
		overflow: hidden;
		padding: 0.45rem 0.5rem;
		border-radius: 2px;
		box-shadow: 0 2px 4px rgb(var(--midnight-rgb) / 8%);
	}

	.event strong,
	.event span,
	.event small,
	.event b {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.event strong {
		margin-bottom: 1px;
		font-size: 0.625rem;
		font-weight: 700;
	}

	.event span {
		font-size: 0.5rem;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}

	.event small {
		margin-top: 0.2rem;
		font-size: 0.53rem;
		font-variant-numeric: tabular-nums;
		white-space: normal;
	}

	.event b {
		margin-bottom: 2px;
		color: var(--danger);
		font-size: 0.4375rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.event-blue {
		color: #0e3a8a;
		background: rgb(var(--sky-rgb) / 28%);
		box-shadow: inset 2px 0 0 var(--club-blue);
	}

	.event-ink {
		color: #fff;
		background: var(--midnight);
	}

	.event-slate {
		color: #1d2b40;
		background: #dce2eb;
		box-shadow: inset 2px 0 0 #667890;
	}

	.event-pale {
		color: #28384e;
		background: #eef1f5;
		box-shadow: inset 2px 0 0 #8593a6;
	}

	.event-line {
		color: #1c2a3f;
		background: #fff;
		border: 1px solid #8c9bae;
	}

	@media (max-width: 50rem) {
		.calendar-frame {
			overflow-x: auto;
			min-width: 44rem;
		}
	}
</style>
