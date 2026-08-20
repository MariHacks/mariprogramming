/** @typedef {'fresh' | 'aging' | 'overdue'} AgeTone */

export const AGE_TONES = Object.freeze(['fresh', 'aging', 'overdue']);

export const AGE_TONE_COLORS = Object.freeze({
	fresh: 'var(--color-muted)',
	aging: 'var(--coral)',
	overdue: 'var(--danger)'
});

/**
 * @param {unknown} ageSeconds
 * @returns {AgeTone}
 */
export function ageTone(ageSeconds) {
	const seconds = Number.isFinite(ageSeconds) ? Math.max(0, /** @type {number} */ (ageSeconds)) : 0;
	if (seconds < 24 * 3600) return 'fresh';
	if (seconds < 3 * 24 * 3600) return 'aging';
	return 'overdue';
}

/**
 * @param {unknown} ageSeconds
 * @returns {string}
 */
export function formatAge(ageSeconds) {
	const seconds = Number.isFinite(ageSeconds) ? Math.max(0, /** @type {number} */ (ageSeconds)) : 0;
	if (seconds < 60) return 'Less than a minute old';
	if (seconds < 3600) {
		const minutes = Math.floor(seconds / 60);
		return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} old`;
	}
	if (seconds < 86400) {
		const hours = Math.floor(seconds / 3600);
		return `${hours} ${hours === 1 ? 'hour' : 'hours'} old`;
	}
	const days = Math.floor(seconds / 86400);
	return `${days} ${days === 1 ? 'day' : 'days'} old`;
}
