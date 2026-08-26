import { describe, expect, it } from 'vitest';
import { headerAccountView, initialsFromDisplayName } from './header-account.js';

describe('initialsFromDisplayName', () => {
	it('uses two initials when a full name is available', () => {
		expect(initialsFromDisplayName('Maya Singh')).toBe('MS');
	});

	it('falls back to the first two characters for a single token', () => {
		expect(initialsFromDisplayName('Maya')).toBe('MA');
	});
});

describe('headerAccountView', () => {
	it('returns signed-out when there is no session', () => {
		expect(headerAccountView(null, null)).toEqual({ kind: 'signed-out' });
	});

	it('returns signed-in identity details from the profile display name', () => {
		expect(
			headerAccountView({ email: 'maya.singh@example.com' }, { displayName: 'Maya Singh' })
		).toEqual({
			kind: 'signed-in',
			displayName: 'Maya Singh',
			initials: 'MS'
		});
	});

	it('falls back to AC when the display name is empty', () => {
		expect(initialsFromDisplayName('')).toBe('AC');
		expect(initialsFromDisplayName('   ')).toBe('AC');
	});

	it('falls back to Account when the session email is empty', () => {
		expect(headerAccountView({ email: '' }, null)).toEqual({ kind: 'signed-out' });
		expect(headerAccountView({ email: '@example.com' }, null)).toEqual({
			kind: 'signed-in',
			displayName: 'Account',
			initials: 'AC'
		});
	});
});
