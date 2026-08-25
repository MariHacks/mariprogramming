/**
 * @param {{
 *   people: import('./parseOmnivox.js').ParsedCourse[][],
 *   labels?: string[],
 *   termId?: string | null,
 *   date?: string | null
 * }} input
 */
export function busyShareDocument(input) {
	return {
		kind: 'maritools-busy',
		termId: input.termId ?? null,
		date: input.date ?? null,
		people: input.people.map((courses, index) => ({
			label: input.labels?.[index] || `Person ${index + 1}`,
			busy: courses.flatMap((course) =>
				course.meetings.map((meeting) => ({
					weekday: meeting.weekday,
					startTime: meeting.startTime,
					endTime: meeting.endTime
				}))
			)
		}))
	};
}

/** @param {Parameters<typeof busyShareDocument>[0]} input */
export function busyShareJson(input) {
	return `${JSON.stringify(busyShareDocument(input), null, 2)}\n`;
}
