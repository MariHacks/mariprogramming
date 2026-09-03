import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/config/environment.js', () => ({
	readRuntimeEnvironment: () => ({
		appOrigin: 'https://example.com',
		googleClientId: 'client-id',
		googleClientSecret: 'client-secret',
		betterAuthSecret: 'a'.repeat(32)
	})
}));

vi.mock('$lib/server/maritools/google-calendar-oauth.js', () => ({
	GCAL_STATE_COOKIE: 'maritools.gcal-oauth-state',
	beginGoogleCalendarConnect: () => ({
		state: 'state-token',
		authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=client-id'
	})
}));

describe('google calendar connect route', () => {
	it('redirects signed-out users to account', async () => {
		const { GET } = await import('./+server.js');
		await expect(
			GET({
				locals: {},
				cookies: { set: vi.fn() }
			})
		).rejects.toMatchObject({ status: 303, location: '/tools/account' });
	});

	it('redirects signed-in users to Google authorize URL', async () => {
		const { GET } = await import('./+server.js');
		const set = vi.fn();
		await expect(
			GET({
				locals: { maritools: { userId: 'user-1', email: 'student@example.com' } },
				cookies: { set }
			})
		).rejects.toMatchObject({
			status: 302,
			location: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=client-id'
		});
		expect(set).toHaveBeenCalled();
	});
});
