/** @typedef {'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'} PaintWeekday */
/** @typedef {import('../term/calendar.js').AcademicTerm} AcademicTerm */
/** @typedef {import('../term/calendar.js').AcademicCalendarRules} AcademicCalendarRules */

import { ACADEMIC_TERMS, rulesForTerm } from '../term/calendar.js';
import { addDays, weekGridForTermWeek } from './academicWeekView.js';

export const PAINT_WEEKDAYS = /** @type {const} */ (['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);

const START_MINUTES = 6 * 60;
const END_MINUTES = 24 * 60;
const STEP_MINUTES = 30;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * @param {number} minutes
 * @returns {string}
 */
export function minutesToTime(minutes) {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/** @returns {string[]} */
export function paintSlotTimes() {
	/** @type {string[]} */
	const slots = [];
	for (let minutes = START_MINUTES; minutes < END_MINUTES; minutes += STEP_MINUTES) {
		slots.push(minutesToTime(minutes));
	}
	return slots;
}

/**
 * Visible label for a paint-grid time rail cell.
 * @param {string} time
 */
export function paintSlotLabel(time) {
	const [hours, minutes] = String(time).split(':').map(Number);
	if (minutes === 30) return ':30';
	if (hours === 0) return '12 AM';
	if (hours === 12) return '12 PM';
	return hours < 12 ? `${hours} AM` : `${hours - 12} PM`;
}

/**
 * @param {PaintWeekday} weekday
 * @param {string} time
 */
export function paintCellKey(weekday, time) {
	return `${weekday}-${time}`;
}

/**
 * Weekday columns for the paint grid, reusing schedule term bounds + college-closed rules.
 * @param {string} weekStartIso
 * @param {string | null | undefined} termId
 * @param {AcademicTerm[]} [terms]
 * @param {Record<string, AcademicCalendarRules>} [rulesByTerm]
 * @returns {{ weekday: PaintWeekday, date: string, dayNumber: number, isNoClass: boolean, outOfTerm: boolean, header: string }[]}
 */
export function paintDayColumnsForTermWeek(
	weekStartIso,
	termId,
	terms = ACADEMIC_TERMS,
	rulesByTerm
) {
	const id = typeof termId === 'string' ? termId.trim() : '';
	const term = id ? (terms.find((entry) => entry.id === id) ?? null) : null;
	const rules = id ? rulesForTerm(id, rulesByTerm) : null;
	if (term && rules) {
		return weekGridForTermWeek(weekStartIso, term, rules, []).map((column) => ({
			weekday: /** @type {PaintWeekday} */ (column.weekday),
			date: column.date,
			dayNumber: column.dayNumber,
			isNoClass: column.isNoClass,
			outOfTerm: column.outOfTerm,
			header: `${column.weekday} ${column.dayNumber}`
		}));
	}
	return PAINT_WEEKDAYS.map((weekday, index) => {
		const date = addDays(weekStartIso, index);
		const dayNumber = Number(date.slice(-2));
		return {
			weekday,
			date,
			dayNumber,
			isNoClass: false,
			outOfTerm: false,
			header: `${weekday} ${dayNumber}`
		};
	});
}

/**
 * Drop painted cells that fall on college-closed or out-of-term columns.
 * @param {Set<string>} cells
 * @param {{ weekday: string, isNoClass: boolean }[]} dayColumns
 * @returns {Set<string>}
 */
export function filterPaintableCells(cells, dayColumns) {
	const closed = new Set(
		dayColumns.filter((column) => column.isNoClass).map((column) => column.weekday)
	);
	if (closed.size === 0) return new Set(cells);
	const next = new Set();
	for (const key of cells) {
		const weekday = key.slice(0, key.indexOf('-'));
		if (!closed.has(weekday)) next.add(key);
	}
	return next;
}

/**
 * @param {unknown} availability
 * @returns {{ byWeek: Record<string, string[]>, legacyFree: string[] | null }}
 */
function readAvailabilityShape(availability) {
	if (!availability || typeof availability !== 'object' || Array.isArray(availability)) {
		return { byWeek: {}, legacyFree: null };
	}
	const record = /** @type {Record<string, unknown>} */ (availability);
	/** @type {Record<string, string[]>} */
	const byWeek = {};
	const rawByWeek = record.byWeek;
	if (rawByWeek && typeof rawByWeek === 'object' && !Array.isArray(rawByWeek)) {
		for (const [week, free] of Object.entries(rawByWeek)) {
			if (!ISO_DATE.test(week) || !Array.isArray(free)) continue;
			byWeek[week] = free.filter((cell) => typeof cell === 'string' && cell.length > 0).sort();
		}
	}
	const legacyFree = Array.isArray(record.free)
		? record.free.filter((cell) => typeof cell === 'string' && cell.length > 0)
		: null;
	return { byWeek, legacyFree };
}

/**
 * Availability cells for one Monday-keyed week.
 * Legacy v1 `{ free }` applies to every week until a v2 `byWeek` save exists.
 * @param {unknown} availability
 * @param {string} weekStartIso
 * @returns {Set<string>}
 */
export function freeCellsFromAvailability(availability, weekStartIso) {
	const week =
		typeof weekStartIso === 'string' && ISO_DATE.test(weekStartIso) ? weekStartIso : '';
	if (!week) return new Set();
	const { byWeek, legacyFree } = readAvailabilityShape(availability);
	const free = Object.keys(byWeek).length > 0 ? (byWeek[week] ?? []) : (legacyFree ?? []);
	return new Set(free.filter((cell) => typeof cell === 'string' && cell.length > 0));
}

/**
 * Legacy helper: serialize a single shared Mon–Fri pattern (v1).
 * Prefer {@link availabilityWithWeek} for new writes.
 * @param {Set<string>} cells
 */
export function availabilityFromFreeCells(cells) {
	return {
		version: 1,
		free: [...cells].sort()
	};
}

/**
 * Merge painted cells into per-week availability (v2).
 * Dropping top-level `free` so legacy shared patterns stop masking empty weeks.
 * @param {unknown} existing
 * @param {string} weekStartIso
 * @param {Set<string>} cells
 */
export function availabilityWithWeek(existing, weekStartIso, cells) {
	const week =
		typeof weekStartIso === 'string' && ISO_DATE.test(weekStartIso) ? weekStartIso : '';
	if (!week) {
		return { version: 2, byWeek: {} };
	}
	const { byWeek } = readAvailabilityShape(existing);
	return {
		version: 2,
		byWeek: {
			...byWeek,
			[week]: [...cells].sort()
		}
	};
}

/**
 * @param {Array<{ availability?: unknown }>} members
 * @param {string} weekStartIso
 * @returns {Set<string>}
 */
export function commonFreeCells(members, weekStartIso) {
	if (members.length === 0) return new Set();
	const intersection = freeCellsFromAvailability(members[0]?.availability, weekStartIso);
	for (const member of members.slice(1)) {
		const cells = freeCellsFromAvailability(member.availability, weekStartIso);
		for (const cell of intersection) {
			if (!cells.has(cell)) intersection.delete(cell);
		}
	}
	return intersection;
}

/**
 * Invert class meetings into free cells on the paint grid.
 * @param {Array<{ meetings?: Array<{ weekday?: string, startTime?: string, endTime?: string }> }>} courses
 * @returns {Set<string>}
 */
export function freeCellsFromCourses(courses) {
	/** @param {string} time */
	function parseMinutes(time) {
		const [hours, minutes] = String(time).split(':').map(Number);
		return hours * 60 + minutes;
	}

	const busy = new Set();
	const slots = paintSlotTimes();
	for (const course of courses) {
		for (const meeting of course.meetings ?? []) {
			const weekday = /** @type {PaintWeekday | undefined} */ (meeting.weekday);
			if (!weekday || !PAINT_WEEKDAYS.includes(weekday)) continue;
			const start = parseMinutes(meeting.startTime ?? '');
			const end = parseMinutes(meeting.endTime ?? '');
			if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
			for (const time of slots) {
				const slot = parseMinutes(time);
				if (slot >= start && slot < end) busy.add(paintCellKey(weekday, time));
			}
		}
	}
	const free = new Set();
	for (const weekday of PAINT_WEEKDAYS) {
		for (const time of slots) {
			const key = paintCellKey(weekday, time);
			if (!busy.has(key)) free.add(key);
		}
	}
	return free;
}

/**
 * @param {string} title
 * @returns {string}
 */
export function slugFromBoardTitle(title) {
	return String(title)
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, '-')
		.replace(/^-+|-+$/gu, '')
		.slice(0, 120);
}

/**
 * Rebuild paint + identity after reload from the local share token, or prefill a signed-in name.
 *
 * @param {{ members?: Array<{ shareToken?: string | null, displayName?: string, availability?: unknown }> } | null | undefined} board
 * @param {string | null | undefined} storedToken
 * @param {string | null | undefined} signedInDisplayName
 * @param {string} weekStartIso
 * @returns {{ shareToken: string, displayName: string, freeCells: Set<string> }}
 */
export function restoreEditorState(board, storedToken, signedInDisplayName, weekStartIso) {
	const shareToken = typeof storedToken === 'string' ? storedToken : '';
	const members = Array.isArray(board?.members) ? board.members : [];
	if (shareToken) {
		const me = members.find((member) => member.shareToken === shareToken);
		if (me) {
			return {
				shareToken,
				displayName: typeof me.displayName === 'string' ? me.displayName : '',
				freeCells: freeCellsFromAvailability(me.availability, weekStartIso)
			};
		}
	}
	const signedIn =
		typeof signedInDisplayName === 'string' ? signedInDisplayName.trim() : '';
	return {
		shareToken,
		displayName: signedIn,
		freeCells: new Set()
	};
}
