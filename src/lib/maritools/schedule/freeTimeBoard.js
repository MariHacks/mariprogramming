/** @typedef {'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'} PaintWeekday */

export const PAINT_WEEKDAYS = /** @type {const} */ (['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);

const START_MINUTES = 8 * 60;
const END_MINUTES = 18 * 60;
const STEP_MINUTES = 30;

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
 * @param {unknown} availability
 * @returns {Set<string>}
 */
export function freeCellsFromAvailability(availability) {
	if (!availability || typeof availability !== 'object' || Array.isArray(availability)) {
		return new Set();
	}
	const free = /** @type {{ free?: unknown }} */ (availability).free;
	if (!Array.isArray(free)) return new Set();
	return new Set(free.filter((cell) => typeof cell === 'string' && cell.length > 0));
}

/**
 * @param {Set<string>} cells
 */
export function availabilityFromFreeCells(cells) {
	return {
		version: 1,
		free: [...cells].sort()
	};
}

/**
 * @param {Array<{ availability?: unknown }>} members
 * @returns {Set<string>}
 */
export function commonFreeCells(members) {
	if (members.length === 0) return new Set();
	const intersection = freeCellsFromAvailability(members[0]?.availability);
	for (const member of members.slice(1)) {
		const cells = freeCellsFromAvailability(member.availability);
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
 * @returns {{ shareToken: string, displayName: string, freeCells: Set<string> }}
 */
export function restoreEditorState(board, storedToken, signedInDisplayName) {
	const shareToken = typeof storedToken === 'string' ? storedToken : '';
	const members = Array.isArray(board?.members) ? board.members : [];
	if (shareToken) {
		const me = members.find((member) => member.shareToken === shareToken);
		if (me) {
			return {
				shareToken,
				displayName: typeof me.displayName === 'string' ? me.displayName : '',
				freeCells: freeCellsFromAvailability(me.availability)
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
