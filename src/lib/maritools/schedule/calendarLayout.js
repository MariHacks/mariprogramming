/** Minutes from midnight for the first visible hour on the schedule grid. */
export const GRID_DAY_START_MINUTES = 8 * 60;

/** Minutes from midnight for the last visible hour on the schedule grid. */
export const GRID_DAY_END_MINUTES = 18 * 60;

/**
 * @param {string} time
 * @returns {number}
 */
export function parseClockTime(time) {
	const [hours, minutes] = String(time).split(':').map(Number);
	return hours * 60 + minutes;
}

/**
 * @param {number} minutes
 * @returns {number}
 */
export function minutesToGridHours(minutes) {
	return (minutes - GRID_DAY_START_MINUTES) / 60;
}

/**
 * @param {number} startMinutes
 * @param {number} endMinutes
 * @returns {number}
 */
export function durationHours(startMinutes, endMinutes) {
	return (endMinutes - startMinutes) / 60;
}

/**
 * @typedef {object} TimedMeeting
 * @property {string} startTime
 * @property {string} endTime
 */

/**
 * @param {TimedMeeting[]} meetings
 * @returns {(TimedMeeting & { startHours: number, durationHours: number, lane: number, lanes: number, conflict: boolean })[]}
 */
export function layoutTimedMeetings(meetings) {
	const sorted = [...meetings].sort((left, right) =>
		left.startTime.localeCompare(right.startTime)
	);
	/** @type {number[]} */
	const laneEnds = [];
	/** @type {(TimedMeeting & { startHours: number, durationHours: number, lane: number, lanes: number, conflict: boolean })[]} */
	const placed = [];

	for (const meeting of sorted) {
		const start = parseClockTime(meeting.startTime);
		const end = parseClockTime(meeting.endTime);
		let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
		if (lane === -1) {
			lane = laneEnds.length;
			laneEnds.push(end);
		} else {
			laneEnds[lane] = end;
		}
		placed.push({
			...meeting,
			startHours: minutesToGridHours(start),
			durationHours: durationHours(start, end),
			lane,
			lanes: laneEnds.length,
			conflict: false
		});
	}

	for (const meeting of placed) {
		const overlapping = placed.filter((other) => rangesOverlap(meeting, other));
		meeting.conflict = overlapping.length > 1;
		meeting.lanes = Math.max(...overlapping.map((item) => item.lane)) + 1;
	}

	return placed;
}

/**
 * @param {TimedMeeting} left
 * @param {TimedMeeting} right
 */
function rangesOverlap(left, right) {
	return (
		parseClockTime(left.startTime) < parseClockTime(right.endTime) &&
		parseClockTime(right.startTime) < parseClockTime(left.endTime)
	);
}

/**
 * Hours from 8 AM for the now-line, or null when the time is off the grid.
 * @param {Date | null | undefined} date
 * @returns {number | null}
 */
export function nowLineHours(date) {
	if (!date || Number.isNaN(date.getTime())) return null;
	const hours = minutesToGridHours(date.getHours() * 60 + date.getMinutes());
	if (hours < 0 || hours > 10) return null;
	return hours;
}

/**
 * @param {number} [count=11]
 * @returns {string[]}
 */
export function gridHourLabels(count = 11) {
	return Array.from({ length: count }, (_, index) => {
		const hour = 8 + index;
		if (hour === 12) return '12 PM';
		return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
	});
}
