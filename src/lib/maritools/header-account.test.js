import { describe, expect, it } from 'vitest';
import { headerAccountView, initialsFromDisplayName } from './header-account.js';

describe('initialsFromDisplayName', () => {
	it('uses two initials when a full name is available', () => {
		expect(initialsFromDisplayName('Maya Singh')).toBe('MS');
		expect(initialsFromDisplayName(/** @type {any} */ (null))).toBe('AC');
	});

	it('falls back to the first two characters for a single token', () => {
		expect(initialsFromDisplayName('Maya')).toBe('MA');
	});
});

describe('headerAccountView', () => {
	it('uses the Google photo unless a custom photo is saved', () => {
		const session = {
			email: 'ada@gmail.com',
			profileImageUrl: 'https://lh3.googleusercontent.com/a/photo'
		};
		expect(headerAccountView(session, null).profileImageDataUrl).toBe(session.profileImageUrl);
		expect(
			headerAccountView(session, { profileImageDataUrl: 'data:image/png;base64,YQ==' })
				.profileImageDataUrl
		).toBe('data:image/png;base64,YQ==');
	});
	it('returns signed-out when there is no session', () => {
		expect(headerAccountView(null, null)).toEqual({ kind: 'signed-out' });
	});

	it('returns signed-in identity details from the profile display name', () => {
		expect(
			headerAccountView(
				{ email: 'maya.singh@example.com' },
				{
					displayName: 'Maya Singh',
					profileImageDataUrl: 'data:image/png;base64,YXZhdGFy'
				}
			)
		).toEqual({
			kind: 'signed-in',
			displayName: 'Maya Singh',
			initials: 'MS',
			profileImageDataUrl: 'data:image/png;base64,YXZhdGFy'
		});
	});

	it('falls back to AC when the display name is empty', () => {
		expect(initialsFromDisplayName('')).toBe('AC');
		expect(initialsFromDisplayName('   ')).toBe('AC');
	});

	it('falls back to the email local part when the profile has no display name', () => {
		expect(headerAccountView({ email: 'maya.singh@example.com' }, { displayName: '   ' })).toEqual({
			kind: 'signed-in',
			displayName: 'maya.singh',
			initials: 'MA'
		});
		expect(headerAccountView({ email: 'maya.singh@example.com' }, null)).toEqual({
			kind: 'signed-in',
			displayName: 'maya.singh',
			initials: 'MA'
		});
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
