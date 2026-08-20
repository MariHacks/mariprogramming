import { describe, expect, it } from 'vitest';
import { AGE_TONE_COLORS, AGE_TONES, ageTone, formatAge } from './age.js';

describe('age presentation', () => {
	it('exposes one frozen tone table and color map', () => {
		expect(AGE_TONES).toEqual(['fresh', 'aging', 'overdue']);
		expect(Object.isFrozen(AGE_TONES)).toBe(true);
		expect(AGE_TONE_COLORS).toEqual({
			fresh: 'var(--color-muted)',
			aging: 'var(--coral)',
			overdue: 'var(--danger)'
		});
		expect(Object.isFrozen(AGE_TONE_COLORS)).toBe(true);
	});

	it.each([
		[0, 'fresh'],
		[3599, 'fresh'],
		[24 * 3600 - 1, 'fresh'],
		[24 * 3600, 'aging'],
		[3 * 24 * 3600 - 1, 'aging'],
		[3 * 24 * 3600, 'overdue'],
		[30 * 24 * 3600, 'overdue']
	])('maps %s seconds to %s', (seconds, tone) => {
		expect(ageTone(seconds)).toBe(tone);
	});

	it.each([
		[-12, 'fresh'],
		[Number.NaN, 'fresh'],
		[undefined, 'fresh'],
		[null, 'fresh']
	])('clamps non-finite and negative %s to fresh', (value, expected) => {
		expect(ageTone(value)).toBe(expected);
	});

	it.each([
		[0, 'Less than a minute old'],
		[59, 'Less than a minute old'],
		[60, '1 minute old'],
		[119, '1 minute old'],
		[120, '2 minutes old'],
		[3599, '59 minutes old'],
		[3600, '1 hour old'],
		[7199, '1 hour old'],
		[7200, '2 hours old'],
		[86399, '23 hours old'],
		[86400, '1 day old'],
		[172799, '1 day old'],
		[172800, '2 days old']
	])('labels %s seconds as %s', (seconds, label) => {
		expect(formatAge(seconds)).toBe(label);
	});

	it('clamps negative age for labels the same way as a just-created row', () => {
		expect(formatAge(-90)).toBe('Less than a minute old');
	});

	it.each([[Number.NaN], [undefined], [null]])(
		'labels non-finite %s the same as a just-created row',
		(value) => {
			expect(formatAge(value)).toBe('Less than a minute old');
		}
	);
});
