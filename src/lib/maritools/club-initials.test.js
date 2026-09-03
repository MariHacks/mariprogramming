import { describe, expect, it } from 'vitest';
import { initialsFromClubName } from './club-initials.js';

describe('initialsFromClubName', () => {
	it('uses the first letters of the first two words', () => {
		expect(initialsFromClubName('Programming Club')).toBe('PC');
	});

	it('falls back to the first two characters', () => {
		expect(initialsFromClubName('Robotics')).toBe('RO');
	});

	it('falls back for empty or missing names', () => {
		expect(initialsFromClubName('')).toBe('');
		expect(initialsFromClubName(/** @type {any} */ (null))).toBe('');
		expect(initialsFromClubName(/** @type {any} */ (undefined))).toBe('');
	});
});
