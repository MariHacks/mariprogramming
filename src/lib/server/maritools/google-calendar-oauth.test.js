import { describe, expect, it } from 'vitest';
import {
	createOAuthState,
	verifyOAuthState,
	beginGoogleCalendarConnect,
	googleCalendarRedirectUri,
	redirectToSchedule
} from './google-calendar-oauth.js';

describe('googleCalendarRedirectUri', () => {
	it('points at the schedule callback route', () => {
		expect(googleCalendarRedirectUri('https://example.com')).toBe(
			'https://example.com/tools/schedule/google-calendar/callback'
		);
	});
});

describe('createOAuthState', () => {
	it('round-trips through verifyOAuthState', () => {
		const secret = 'test-secret-key-with-enough-length';
		const state = createOAuthState(secret);
		expect(verifyOAuthState(state, secret)).toBe(true);
		expect(verifyOAuthState(`${state}x`, secret)).toBe(false);
		expect(verifyOAuthState(null, secret)).toBe(false);
		expect(verifyOAuthState(`${'a'.repeat(32)}.${'z'.repeat(64)}`, secret)).toBe(false);
		expect(verifyOAuthState(/** @type {any} */ (null), secret)).toBe(false);
	});
});

describe('beginGoogleCalendarConnect', () => {
	it('returns a Google authorize URL with offline access', () => {
		const { authorizeUrl } = beginGoogleCalendarConnect({
			clientId: 'client-id',
			appOrigin: 'https://example.com',
			secret: 'test-secret-key-with-enough-length'
		});
		const url = new URL(authorizeUrl);
		expect(url.hostname).toBe('accounts.google.com');
		expect(url.searchParams.get('access_type')).toBe('offline');
		expect(url.searchParams.get('redirect_uri')).toBe(
			'https://example.com/tools/schedule/google-calendar/callback'
		);
	});

	it('uses APP_ORIGIN host and port in the calendar redirect URI', () => {
		const { authorizeUrl } = beginGoogleCalendarConnect({
			clientId: '245259091681-example.apps.googleusercontent.com',
			appOrigin: 'http://127.0.0.1:5174',
			secret: 'test-secret-key-with-enough-length'
		});
		const url = new URL(authorizeUrl);
		expect(url.searchParams.get('redirect_uri')).toBe(
			'http://127.0.0.1:5174/tools/schedule/google-calendar/callback'
		);
		expect(url.searchParams.get('redirect_uri')).not.toBe(
			'http://127.0.0.1:5174/api/auth/callback/google'
		);
	});
});

describe('redirectToSchedule', () => {
	it('throws a 303 to the schedule page', () => {
		expect(() => redirectToSchedule()).toThrow();
		try {
			redirectToSchedule('/tools/schedule?gcal=error');
		} catch (error) {
			expect(error).toMatchObject({ status: 303, location: '/tools/schedule?gcal=error' });
		}
	});
});
