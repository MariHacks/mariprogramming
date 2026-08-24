/** @typedef {'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'} Weekday */

/**
 * @typedef {object} WeeklyMeeting
 * @property {Weekday} weekday
 * @property {string} startTime
 * @property {string} endTime
 * @property {string} classroom
 */

/**
 * @typedef {object} ParsedCourse
 * @property {string} title
 * @property {string} courseCode
 * @property {string} section
 * @property {string} teacher
 * @property {WeeklyMeeting[]} meetings
 */

/**
 * @typedef {object} ParseResult
 * @property {boolean} ok
 * @property {ParsedCourse[]} courses
 * @property {string[]} warnings
 */

const WEEKDAY = '(Mon|Tue|Wed|Thu|Fri)';
const COURSE_HEAD = /^\s*(\d+)\s+(\S.*\S)\s*$/;
const CODE_LINE =
	/^([A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+)\s+sec\.(\d+)\s*,\s*teacher:\s*(.+?)\s*$/i;
const MEETING_LINE = new RegExp(
	`^${WEEKDAY}\\s+(\\d{2}:\\d{2})\\s*-\\s*(\\d{2}:\\d{2})\\s*,\\s*classroom\\s+(.+?)\\s*$`,
	'i'
);
const STUDENT_NUMBER_LINE = /(?:student\s*number|^.{0,80}[-–]\s*\d{5,8}\s*$)/i;
const BARE_STUDENT_NUMBER = /^\s*\d{6,8}\s*$/;

/**
 * @param {string | null | undefined} raw
 * @returns {ParseResult}
 */
export function parseOmnivox(raw) {
	const text = String(raw ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	const lines = text.split('\n').map((line) => line.replace(/[ \t]+$/g, ''));
	/** @type {string[]} */
	const warnings = [];
	/** @type {ParsedCourse[]} */
	const courses = [];
	/** @type {ParsedCourse | null} */
	let current = null;

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed === '') continue;

		if (STUDENT_NUMBER_LINE.test(trimmed) || BARE_STUDENT_NUMBER.test(trimmed)) {
			warnings.push(
				'That paste looks like it includes a student number. Copy only the numbered course list on the right.'
			);
			continue;
		}

		const head = COURSE_HEAD.exec(line.replace(/\t/g, '  '));
		if (head) {
			current = {
				title: head[2].trim(),
				courseCode: '',
				section: '',
				teacher: '',
				meetings: []
			};
			courses.push(current);
			continue;
		}

		if (!current) continue;

		const code = CODE_LINE.exec(trimmed);
		if (code) {
			current.courseCode = code[1].toUpperCase();
			current.section = code[2];
			current.teacher = code[3].trim();
			continue;
		}

		const meeting = MEETING_LINE.exec(trimmed);
		if (meeting) {
			current.meetings.push({
				weekday: /** @type {Weekday} */ (
					meeting[1][0].toUpperCase() + meeting[1].slice(1).toLowerCase()
				),
				startTime: meeting[2],
				endTime: meeting[3],
				classroom: meeting[4].trim()
			});
		}
	}

	const complete = courses.filter(
		(course) =>
			course.courseCode && course.section && course.teacher && course.meetings.length > 0
	);

	if (complete.length === 0) {
		return {
			ok: false,
			courses: [],
			warnings: warnings.length
				? warnings
				: ['Could not read a compact course list from that paste.']
		};
	}

	return { ok: true, courses: complete, warnings };
}
