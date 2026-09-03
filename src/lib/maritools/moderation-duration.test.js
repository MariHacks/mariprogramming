import { describe, expect, it } from 'vitest';
import {
	DEFAULT_BAN_PRESET,
	DEFAULT_MUTE_PRESET,
	formatRemaining,
	parseModerationDuration,
	untilFromDuration
} from './moderation-duration.js';

describe('moderation duration helpers', () => {
	it('defaults mute to 7 days and ban to permanent', () => {
		expect(DEFAULT_MUTE_PRESET).toBe('7d');
		expect(DEFAULT_BAN_PRESET).toBe('permanent');
		const mute = parseModerationDuration({}, 'mute');
		expect(mute.preset).toBe('7d');
		expect(mute.until?.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
		expect(parseModerationDuration({}, 'ban')).toEqual({
			permanent: true,
			until: null,
			preset: 'permanent',
			label: 'Permanent'
		});
	});

	it('accepts mute hour presets and custom hour amounts', () => {
		const hour = parseModerationDuration({ mutePreset: '1h' }, 'mute');
		expect(hour.label).toBe('1 hour');
		expect(hour.until.getTime()).toBeLessThan(Date.now() + 2 * 60 * 60 * 1000);

		const custom = parseModerationDuration(
			{ mutePreset: 'custom', muteCustomAmount: '3', muteCustomUnit: 'hours' },
			'mute'
		);
		expect(custom.label).toBe('3 hours');
		expect(custom.until.getTime()).toBeGreaterThan(Date.now() + 2 * 60 * 60 * 1000);
	});

	it('accepts timed ban presets without forcing permanent', () => {
		const ban = parseModerationDuration({ banPreset: '30d' }, 'ban');
		expect(ban.permanent).toBe(false);
		expect(ban.label).toBe('30 days');
		expect(ban.until).toBeInstanceOf(Date);
	});

	it('builds until timestamps from hours and days', () => {
		const now = Date.UTC(2026, 7, 30, 12, 0, 0);
		expect(untilFromDuration({ hours: 2 }, now).toISOString()).toBe('2026-08-30T14:00:00.000Z');
		expect(untilFromDuration({ days: 1 }, now).toISOString()).toBe('2026-08-31T12:00:00.000Z');
	});

	it('formats remaining restriction time', () => {
		const inThreeHours = new Date(Date.now() + 3 * 60 * 60 * 1000);
		expect(formatRemaining(inThreeHours)).toMatch(/hour/);
		expect(formatRemaining(null)).toBeNull();
		expect(formatRemaining(new Date(Date.now() - 1000))).toBe('expired');
	});

	it('covers invalid, capped, and combined duration boundaries', () => {
		const now = Date.UTC(2026, 0, 1);
		expect(untilFromDuration({}, now).getTime()).toBe(now + 7 * 24 * 60 * 60 * 1000);
		expect(untilFromDuration({ hours: 1, days: 1 }, now).getTime()).toBe(now + 25 * 60 * 60 * 1000);
		expect(untilFromDuration({ days: 999 }, now).getTime()).toBe(now + 366 * 24 * 60 * 60 * 1000);
	});

	it('parses FormData and custom fallback boundaries', () => {
		const form = new FormData();
		form.set('mutePreset', 'custom');
		form.set('muteCustomAmount', '1');
		form.set('muteCustomUnit', 'hours');
		expect(parseModerationDuration(form, 'mute').label).toBe('1 hour');
		expect(
			parseModerationDuration(
				{ banPreset: 'custom', banCustomAmount: '1', banCustomUnit: 'days' },
				'ban'
			).label
		).toBe('1 day');
		expect(parseModerationDuration({ mutePreset: 'unknown' }, 'mute').preset).toBe('7d');
		expect(parseModerationDuration({ mutePreset: ' ' }, 'mute').preset).toBe('7d');
		expect(
			parseModerationDuration({ mutePreset: 'custom', muteCustomAmount: '' }, 'mute').label
		).toBe('1 day');
		expect(
			parseModerationDuration({ mutePreset: 'custom', muteCustomAmount: '999' }, 'mute').label
		).toBe('366 days');
		expect(
			parseModerationDuration({ mutePreset: 'custom', muteCustomAmount: '-4' }, 'mute').label
		).toBe('1 day');
	});

	it('formats invalid, singular hour, and day ranges', () => {
		const now = Date.UTC(2026, 0, 1);
		expect(formatRemaining('not-a-date', now)).toBe('expired');
		expect(formatRemaining(new Date(now + 60 * 60 * 1000), now)).toBe('1 hour left');
		expect(formatRemaining(new Date(now + 48 * 60 * 60 * 1000), now)).toBe('2 days left');
	});
});
