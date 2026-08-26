import { describe, expect, it, vi } from 'vitest';
import { accessTokenExpired, resolveGoogleCalendarAccessToken } from './google-calendar-push.js';

describe('accessTokenExpired', () => {
	it('treats missing expiry as expired', () => {
		expect(accessTokenExpired(null)).toBe(true);
	});

	it('treats tokens within one minute as expired', () => {
		expect(accessTokenExpired(new Date(Date.now() + 30_000))).toBe(true);
	});

	it('accepts tokens with more than one minute left', () => {
		expect(accessTokenExpired(new Date(Date.now() + 120_000))).toBe(false);
	});
});

describe('resolveGoogleCalendarAccessToken', () => {
	it('returns a cached access token when still valid', async () => {
		const store = {
			getGrant: vi.fn().mockResolvedValue({
				refreshToken: 'refresh',
				accessToken: 'cached-token',
				accessTokenExpiresAt: new Date(Date.now() + 120_000)
			}),
			updateAccessToken: vi.fn()
		};
		const token = await resolveGoogleCalendarAccessToken(
			/** @type {any} */ (store),
			'user-1',
			{ googleClientId: 'id', googleClientSecret: 'secret' },
			vi.fn()
		);
		expect(token).toBe('cached-token');
		expect(store.updateAccessToken).not.toHaveBeenCalled();
	});
});
