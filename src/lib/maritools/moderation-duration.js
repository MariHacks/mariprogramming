/**
 * Staff mute/ban duration presets and form parsing.
 */

/** @typedef {{ id: string, label: string, hours?: number, days?: number, permanent?: boolean }} DurationPreset */

/** @type {readonly DurationPreset[]} */
export const MUTE_PRESETS = Object.freeze([
	{ id: '1h', label: '1 hour', hours: 1 },
	{ id: '1d', label: '1 day', days: 1 },
	{ id: '7d', label: '7 days', days: 7 },
	{ id: '30d', label: '30 days', days: 30 },
	{ id: 'custom', label: 'Custom' }
]);

/** @type {readonly DurationPreset[]} */
export const BAN_PRESETS = Object.freeze([
	{ id: '1d', label: '1 day', days: 1 },
	{ id: '7d', label: '7 days', days: 7 },
	{ id: '30d', label: '30 days', days: 30 },
	{ id: '1y', label: '1 year', days: 365 },
	{ id: 'permanent', label: 'Permanent', permanent: true },
	{ id: 'custom', label: 'Custom' }
]);

export const DEFAULT_MUTE_PRESET = '7d';
export const DEFAULT_BAN_PRESET = 'permanent';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_DURATION_MS = 366 * DAY_MS;

/**
 * @param {{ hours?: number, days?: number }} opts
 * @param {number} [now]
 * @returns {Date}
 */
export function untilFromDuration(opts, now = Date.now()) {
	const hours = Number(opts.hours);
	const days = Number(opts.days);
	let ms = 0;
	if (Number.isFinite(hours) && hours > 0) ms += hours * HOUR_MS;
	if (Number.isFinite(days) && days > 0) ms += days * DAY_MS;
	if (ms <= 0) ms = 7 * DAY_MS;
	ms = Math.min(ms, MAX_DURATION_MS);
	return new Date(now + ms);
}

/**
 * @param {FormData | Record<string, FormDataEntryValue | null | undefined>} data
 * @param {'mute' | 'ban'} kind
 * @returns {{ permanent: boolean, until: Date | null, preset: string, label: string }}
 */
export function parseModerationDuration(data, kind) {
	const get = (key) => {
		if (data instanceof FormData) return data.get(key);
		return data[key] ?? null;
	};
	const presets = kind === 'mute' ? MUTE_PRESETS : BAN_PRESETS;
	const fallback = kind === 'mute' ? DEFAULT_MUTE_PRESET : DEFAULT_BAN_PRESET;
	const presetId = String(get(`${kind}Preset`) ?? fallback).trim() || fallback;
	const preset = presets.find((row) => row.id === presetId) ?? presets.find((row) => row.id === fallback);

	if (preset?.permanent) {
		return { permanent: true, until: null, preset: 'permanent', label: 'Permanent' };
	}

	if (preset && preset.id !== 'custom') {
		const until = untilFromDuration({ hours: preset.hours, days: preset.days });
		return { permanent: false, until, preset: preset.id, label: preset.label };
	}

	const amount = Math.max(1, Math.min(Number(get(`${kind}CustomAmount`)) || 1, 366));
	const unit = String(get(`${kind}CustomUnit`) ?? 'days').trim() === 'hours' ? 'hours' : 'days';
	const until =
		unit === 'hours' ? untilFromDuration({ hours: amount }) : untilFromDuration({ days: amount });
	const label = `${amount} ${unit === 'hours' ? (amount === 1 ? 'hour' : 'hours') : amount === 1 ? 'day' : 'days'}`;
	return { permanent: false, until, preset: 'custom', label };
}

/**
 * @param {Date | string | null | undefined} until
 * @param {number} [now]
 */
export function formatRemaining(until, now = Date.now()) {
	if (!until) return null;
	const end = until instanceof Date ? until.getTime() : new Date(until).getTime();
	if (!Number.isFinite(end) || end <= now) return 'expired';
	const ms = end - now;
	const hours = Math.ceil(ms / HOUR_MS);
	if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} left`;
	const days = Math.ceil(ms / DAY_MS);
	return `${days} day${days === 1 ? '' : 's'} left`;
}
