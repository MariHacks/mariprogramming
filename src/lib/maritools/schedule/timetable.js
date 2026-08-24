/** @typedef {import('./parseOmnivox.js').ParsedCourse} ParsedCourse */
/** @typedef {import('./parseOmnivox.js').WeeklyMeeting} WeeklyMeeting */

/** @type {['Mon', 'Tue', 'Wed', 'Thu', 'Fri']} */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

/**
 * @typedef {WeeklyMeeting & { title: string, courseCode: string, section: string, teacher: string }} PlacedMeeting
 */

/**
 * @param {ParsedCourse[]} courses
 * @returns {{ weekday: (typeof WEEKDAYS)[number], meetings: PlacedMeeting[], overlap: boolean }[]}
 */
export function weekGrid(courses) {
	return WEEKDAYS.map((weekday) => {
		const meetings = courses
			.flatMap((course) =>
				course.meetings
					.filter((meeting) => meeting.weekday === weekday)
					.map((meeting) => ({
						...meeting,
						title: course.title,
						courseCode: course.courseCode,
						section: course.section,
						teacher: course.teacher
					}))
			)
			.sort((left, right) => left.startTime.localeCompare(right.startTime));
		return { weekday, meetings, overlap: hasOverlap(meetings) };
	});
}

/**
 * @param {{ startTime: string, endTime: string }[]} meetings
 * @returns {boolean}
 */
export function hasOverlap(meetings) {
	for (let i = 0; i < meetings.length; i += 1) {
		for (let j = i + 1; j < meetings.length; j += 1) {
			if (meetings[i].startTime < meetings[j].endTime && meetings[j].startTime < meetings[i].endTime) {
				return true;
			}
		}
	}
	return false;
}
