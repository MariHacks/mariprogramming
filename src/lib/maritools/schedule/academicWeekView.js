/** @typedef {import('../term/calendar.js').AcademicTerm} AcademicTerm */
/** @typedef {import('../term/calendar.js').AcademicCalendarRules} AcademicCalendarRules */
/** @typedef {import('./parseOmnivox.js').ParsedCourse} ParsedCourse */
/** @typedef {import('./timetable.js').PlacedMeeting} PlacedMeeting */

import { calendarDate } from '../term/calendar.js';
import { effectiveWeekdayForDate } from './freeTime.js';
import { hasOverlap, WEEKDAYS } from './timetable.js';

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
 * @param {string} isoDate
 * @returns {string}
 */
export function mondayOfWeek(isoDate) {
	const date = utcDay(isoDate);
	const civil = date.getUTCDay();
	const offset = civil === 0 ? -6 : 1 - civil;
	date.setUTCDate(date.getUTCDate() + offset);
	return toIsoDate(date);
}

/**
 * @param {string} isoDate
 * @param {number} days
 * @returns {string}
 */
export function addDays(isoDate, days) {
	const date = utcDay(isoDate);
	date.setUTCDate(date.getUTCDate() + days);
	return toIsoDate(date);
}

/**
 * @param {string} isoDate
 * @param {AcademicTerm} term
 * @returns {boolean}
 */
export function isClassDayInTerm(isoDate, term) {
	return isoDate >= term.classStartDate && isoDate <= term.classEndDate;
}

/**
 * @param {string} weekStartIso Monday YYYY-MM-DD
 * @param {AcademicTerm} term
 * @param {AcademicCalendarRules} rules
 * @param {ParsedCourse[]} courses
 * @param {string} [todayIso]
 * @returns {{ date: string, weekday: (typeof WEEKDAYS)[number], dayNumber: number, isToday: boolean, isNoClass: boolean, outOfTerm: boolean, meetings: PlacedMeeting[], overlap: boolean }[]}
 */
export function weekGridForTermWeek(weekStartIso, term, rules, courses, todayIso = calendarDate()) {
	return WEEKDAYS.map((weekday, index) => {
		const date = addDays(weekStartIso, index);
		const outOfTerm = !isClassDayInTerm(date, term);
		const effectiveWeekday = effectiveWeekdayForDate(date, rules);
		const isNoClass = outOfTerm || effectiveWeekday === null;

		/** @type {PlacedMeeting[]} */
		const meetings = isNoClass
			? []
			: courses
					.flatMap((course) =>
						course.meetings
							.filter((meeting) => meeting.weekday === effectiveWeekday)
							.map((meeting) => ({
								...meeting,
								title: course.title,
								courseCode: course.courseCode,
								section: course.section,
								teacher: course.teacher
							}))
					)
					.sort((left, right) => left.startTime.localeCompare(right.startTime));

		return {
			date,
			weekday,
			dayNumber: Number(date.slice(-2)),
			isToday: date === todayIso,
			isNoClass,
			outOfTerm,
			meetings,
			overlap: hasOverlap(meetings)
		};
	});
}

/**
 * @param {string} weekStartIso
 * @returns {string}
 */
export function weekTitle(weekStartIso) {
	const start = utcDay(weekStartIso);
	const end = utcDay(addDays(weekStartIso, 4));
	const month = start.toLocaleString('en-CA', { month: 'long', timeZone: 'UTC' });
	const startDay = start.getUTCDate();
	const endDay = end.getUTCDate();
	if (start.getUTCMonth() === end.getUTCMonth()) {
		return `Week of ${month} ${startDay}`;
	}
	const endMonth = end.toLocaleString('en-CA', { month: 'long', timeZone: 'UTC' });
	return `Week of ${month} ${startDay} – ${endMonth} ${endDay}`;
}
