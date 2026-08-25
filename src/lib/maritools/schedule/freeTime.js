/** @typedef {import('./parseOmnivox.js').ParsedCourse} ParsedCourse */
/** @typedef {{ startTime: string, endTime: string }} Interval */

import { WEEKDAYS } from './timetable.js';

/**
 * @param {string} isoDate
 * @returns {Date}
 */
function utcDay(isoDate) {
	const [year, month, day] = isoDate.split('-').map(Number);
	return new Date(Date.UTC(year, month - 1, day));
}

const CIVIL_WEEKDAY = /** @type {const} */ (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

/**
 * @param {string} isoDate
 * @param {{ noClassDates: string[], scheduleOverrides: { date: string, followsWeekday: string }[] }} rules
 * @returns {string | null}
 */
export function effectiveWeekdayForDate(isoDate, rules) {
	if (rules.noClassDates.includes(isoDate)) return null;
	const override = rules.scheduleOverrides.find((entry) => entry.date === isoDate);
	const civil = CIVIL_WEEKDAY[utcDay(isoDate).getUTCDay()];
	const weekday = override?.followsWeekday ?? civil;
	if (weekday === 'Sat' || weekday === 'Sun') return null;
	return weekday;
}

/**
 * @param {ParsedCourse[][]} people
 * @param {string} isoDate
 * @param {{ noClassDates: string[], scheduleOverrides: { date: string, followsWeekday: string }[] }} rules
 * @param {number} [minimumMinutes]
 */
export function commonFreeOnDate(people, isoDate, rules, minimumMinutes = 30) {
	const weekday = effectiveWeekdayForDate(isoDate, rules);
	if (!weekday) return [];
	return commonFreeOnWeekday(people, weekday, minimumMinutes);
}

/**
 * @param {Interval[]} busy
 * @param {number} [minimumMinutes]
 * @returns {Interval[]}
 */
export function commonFreeFromBusy(busy, minimumMinutes = 30) {
	const sorted = [...busy].sort((left, right) => left.startTime.localeCompare(right.startTime));
	/** @type {Interval[]} */
	const merged = [];
	for (const slot of sorted) {
		const last = merged[merged.length - 1];
		if (last && slot.startTime <= last.endTime) {
			if (slot.endTime > last.endTime) last.endTime = slot.endTime;
		} else {
			merged.push({ ...slot });
		}
	}

	const dayStart = '08:00';
	const dayEnd = '18:00';
	/** @type {Interval[]} */
	const free = [];
	let cursor = dayStart;
	for (const slot of merged) {
		if (slot.startTime > cursor) {
			free.push({ startTime: cursor, endTime: slot.startTime });
		}
		if (slot.endTime > cursor) cursor = slot.endTime;
	}
	if (cursor < dayEnd) free.push({ startTime: cursor, endTime: dayEnd });

	return free.filter((slot) => minutesBetween(slot.startTime, slot.endTime) >= minimumMinutes);
}

/**
 * @param {{ date: string, startTime: string, endTime: string }[]} occurrences
 * @param {string} isoDate
 * @param {number} [minimumMinutes]
 */
export function commonFreeFromOccurrences(occurrences, isoDate, minimumMinutes = 30) {
	return commonFreeFromBusy(
		occurrences
			.filter((row) => row.date === isoDate)
			.map((row) => ({ startTime: row.startTime, endTime: row.endTime })),
		minimumMinutes
	);
}

/**
 * @param {ParsedCourse[][]} people
 * @param {string} weekday
 * @param {number} [minimumMinutes]
 * @returns {Interval[]}
 */
export function commonFreeOnWeekday(people, weekday, minimumMinutes = 30) {
	/** @type {Interval[]} */
	const busy = people.flatMap((courses) =>
		courses.flatMap((course) =>
			course.meetings
				.filter((meeting) => meeting.weekday === weekday)
				.map((meeting) => ({ startTime: meeting.startTime, endTime: meeting.endTime }))
		)
	);
	return commonFreeFromBusy(busy, minimumMinutes);
}

/**
 * @param {ParsedCourse[][]} people
 * @param {number} [minimumMinutes]
 */
export function commonFreeWeek(people, minimumMinutes = 30) {
	return WEEKDAYS.map((weekday) => ({
		weekday,
		slots: commonFreeOnWeekday(people, weekday, minimumMinutes)
	}));
}

/**
 * @param {string} start
 * @param {string} end
 * @returns {number}
 */
function minutesBetween(start, end) {
	const [sh, sm] = start.split(':').map(Number);
	const [eh, em] = end.split(':').map(Number);
	return eh * 60 + em - (sh * 60 + sm);
}
