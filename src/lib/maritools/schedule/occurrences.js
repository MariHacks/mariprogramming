/** @typedef {import('../term/calendar.js').AcademicTerm} AcademicTerm */
/** @typedef {import('../term/calendar.js').AcademicCalendarRules} AcademicCalendarRules */
/** @typedef {import('../term/calendar.js').Weekday} Weekday */
/** @typedef {import('./parseOmnivox.js').ParsedCourse} ParsedCourse */

/**
 * @typedef {object} ClassOccurrence
 * @property {string} courseCode
 * @property {string} title
 * @property {string} section
 * @property {string} teacher
 * @property {string} classroom
 * @property {string} date
 * @property {string} startTime
 * @property {string} endTime
 */

const CIVIL_WEEKDAY = /** @type {const} */ ([
	'Sun',
	'Mon',
	'Tue',
	'Wed',
	'Thu',
	'Fri',
	'Sat'
]);

/**
 * @param {string} isoDate
 * @returns {Date}
 */
function utcDay(isoDate) {
	const [year, month, day] = isoDate.split('-').map(Number);
	return new Date(Date.UTC(year, month - 1, day));
}

/**
 * @param {Date} date
 * @returns {string}
 */
function toIsoDate(date) {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/**
 * @param {AcademicTerm} term
 * @param {AcademicCalendarRules} rules
 * @param {ParsedCourse[]} courses
 * @returns {ClassOccurrence[]}
 */
export function generateOccurrences(term, rules, courses) {
	const noClass = new Set(rules.noClassDates);
	/** @type {Map<string, Weekday>} */
	const overrides = new Map(
		rules.scheduleOverrides.map((entry) => [entry.date, entry.followsWeekday])
	);

	const start = utcDay(term.classStartDate);
	const end = utcDay(term.classEndDate);
	/** @type {ClassOccurrence[]} */
	const occurrences = [];

	for (let cursor = new Date(start.getTime()); cursor.getTime() <= end.getTime(); ) {
		const date = toIsoDate(cursor);
		if (!noClass.has(date)) {
			const civil = CIVIL_WEEKDAY[cursor.getUTCDay()];
			const follows = overrides.get(date) ?? civil;
			if (follows !== 'Sun' && follows !== 'Sat') {
				for (const course of courses) {
					for (const meeting of course.meetings) {
						if (meeting.weekday !== follows) continue;
						occurrences.push({
							courseCode: course.courseCode,
							title: course.title,
							section: course.section,
							teacher: course.teacher,
							classroom: meeting.classroom,
							date,
							startTime: meeting.startTime,
							endTime: meeting.endTime
						});
					}
				}
			}
		}

		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}

	return occurrences;
}
