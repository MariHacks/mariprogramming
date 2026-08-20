import { describe, expect, it } from 'vitest';
import { workAge } from './age.js';

describe('book work age', () => {
	it.each([
		[-1, 'fresh', 'var(--color-muted)'],
		[0, 'fresh', 'var(--color-muted)'],
		[86399, 'fresh', 'var(--color-muted)'],
		[86400, 'aging', 'var(--coral)'],
		[3 * 24 * 3600 - 1, 'aging', 'var(--coral)'],
		[3 * 24 * 3600, 'overdue', 'var(--danger)'],
		[7 * 24 * 3600, 'overdue', 'var(--danger)']
	])('classifies %s seconds as %s', (seconds, band, tone) => {
		expect(workAge(seconds)).toMatchObject({ seconds: Math.max(0, seconds), band, tone });
	});

	it('reuses the staff age wording', () => {
		expect(workAge(3660)).toEqual({
			seconds: 3660,
			label: '1 hour old',
			band: 'fresh',
			tone: 'var(--color-muted)'
		});
	});

	it('treats non-finite input as fresh', () => {
		expect(workAge(Number.NaN)).toMatchObject({ seconds: 0, band: 'fresh' });
	});
});
