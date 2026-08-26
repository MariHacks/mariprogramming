import { describe, expect, it } from 'vitest';
import {
	createOAuthState,
	verifyOAuthState,
	beginGoogleCalendarConnect,
	googleCalendarRedirectUri
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
	});
});
