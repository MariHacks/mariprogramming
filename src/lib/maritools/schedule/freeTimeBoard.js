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
	/** @type {Set<string> | null} */
	let intersection = null;
	for (const member of members) {
		const cells = freeCellsFromAvailability(member.availability);
		if (intersection === null) {
			intersection = new Set(cells);
			continue;
		}
		for (const cell of intersection) {
			if (!cells.has(cell)) intersection.delete(cell);
		}
	}
	return intersection ?? new Set();
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
