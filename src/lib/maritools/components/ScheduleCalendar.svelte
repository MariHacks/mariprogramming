<script>
	import { layoutTimedMeetings, gridHourLabels, nowLineHours } from '$lib/maritools/schedule/calendarLayout.js';

	/** @type {{ date: string, weekday: string, dayNumber: number, isToday: boolean, isNoClass: boolean, outOfTerm: boolean, meetings: import('$lib/maritools/schedule/timetable.js').PlacedMeeting[], overlap: boolean }[]} */
	export let grid = [];

	/** @type {Date | null} */
	export let now = null;
	/** @type {boolean} */
	export let weekdayOnly = false;

	const hourLabels = gridHourLabels();

	$: lineHours = nowLineHours(now ?? new Date());
	$: showNow = Boolean(lineHours != null && grid.some((column) => column.isToday));

	function eventTone(index) {
		return ['event-blue', 'event-ink', 'event-slate', 'event-pale', 'event-line'][index % 5];
	}

	function timeRange(startTime, endTime) {
		return `${formatClock(startTime)}-${formatClock(endTime)}`;
	}

	function formatClock(time) {
		const [hours, minutes] = String(time).split(':');
		return `${Number(hours)}:${minutes}`;
	}
</script>

<div
	class="calendar-frame schedule-calendar"
	class:weekday-only={weekdayOnly}
	aria-label="Weekly course schedule"
>
	<div class="calendar-corner"><span>EST</span></div>
	{#each grid as column (column.date)}
		<div class="day-head" class:is-today={column.isToday} class:is-no-class={column.isNoClass}>
			<span>{column.weekday}</span>
			{#if !weekdayOnly}
				<strong>{column.dayNumber}</strong>
				{#if column.isToday}<i>Today</i>{/if}
				{#if column.isNoClass && !column.outOfTerm}<i class="muted">No class</i>{/if}
			{/if}
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
					class:event-danger={meeting.conflict}
					style={`--start:${meeting.startHours}; --duration:${meeting.durationHours}; --lane:${meeting.lane}; --lanes:${meeting.lanes}`}
				>
					{#if meeting.conflict}<b>Conflict</b>{/if}
					<strong>{meeting.title}</strong>
					<span>{meeting.courseCode}</span>
					<small>{timeRange(meeting.startTime, meeting.endTime)}<br />{meeting.classroom}</small>
				</article>
			{/each}
		</div>
	{/each}
	{#if showNow}
		<div class="now-line" style={`--now-hours:${lineHours}`}>
			<span
				>{(now ?? new Date()).toLocaleTimeString(undefined, {
					hour: 'numeric',
					minute: '2-digit'
				})}</span
			><i></i>
		</div>
	{/if}
</div>
