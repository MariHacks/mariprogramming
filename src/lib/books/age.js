import { AGE_TONE_COLORS, ageTone, formatAge } from '$lib/shared/age.js';

/** @typedef {{ seconds: number, label: string, band: 'fresh' | 'aging' | 'overdue', tone: string }} WorkAge */

/**
 * @param {unknown} value
 * @returns {Readonly<WorkAge>}
 */
export function workAge(value) {
	const seconds =
		typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
	const band = ageTone(seconds);
	return Object.freeze({
		seconds,
		label: formatAge(seconds),
		band,
		tone: AGE_TONE_COLORS[band]
	});
}
