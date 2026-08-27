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
	verifyOAuthState: (state) => state === 'valid-state'
}));

vi.mock('$lib/server/maritools/google-calendar-store.js', () => ({
	openGoogleCalendarStore: () => ({})
}));

const completeGoogleCalendarConnect = vi.fn();
vi.mock('$lib/server/maritools/google-calendar-push.js', () => ({
	completeGoogleCalendarConnect: (...args) => completeGoogleCalendarConnect(...args)
}));

describe('google calendar callback route', () => {
	it('redirects signed-out users to account', async () => {
		const { GET } = await import('./+server.js');
		await expect(
			GET({
				locals: {},
				cookies: { get: vi.fn(), delete: vi.fn() },
				url: new URL('https://example.com/tools/schedule/google-calendar/callback')
			})
		).rejects.toMatchObject({ status: 303, location: '/tools/account' });
	});

	it('rejects a missing or mismatched state', async () => {
		const { GET } = await import('./+server.js');
		const cookies = { get: vi.fn(() => 'valid-state'), delete: vi.fn() };
		await expect(
			GET({
				locals: { maritools: { userId: 'user-1' } },
				cookies,
				url: new URL('https://example.com/tools/schedule/google-calendar/callback?state=other&code=abc')
			})
		).rejects.toMatchObject({ status: 303, location: '/tools/schedule?gcal=error' });
		expect(cookies.delete).toHaveBeenCalled();
		await expect(
			GET({
				locals: { maritools: { userId: 'user-1' } },
				cookies: { get: vi.fn(() => undefined), delete: vi.fn() },
				url: new URL(
					'https://example.com/tools/schedule/google-calendar/callback?state=valid-state&code=abc'
				)
			})
		).rejects.toMatchObject({ status: 303, location: '/tools/schedule?gcal=error' });
		await expect(
			GET({
				locals: { maritools: {} },
				cookies: { get: vi.fn(), delete: vi.fn() },
				url: new URL('https://example.com/tools/schedule/google-calendar/callback')
			})
		).rejects.toMatchObject({ status: 303, location: '/tools/account' });
		await expect(
			GET({
				locals: { maritools: { userId: 'user-1' } },
				cookies: { get: vi.fn(() => 'valid-state'), delete: vi.fn() },
				url: new URL(
					'https://example.com/tools/schedule/google-calendar/callback?state=valid-state'
				)
			})
		).rejects.toMatchObject({ status: 303, location: '/tools/schedule?gcal=error' });
		await expect(
			GET({
				locals: { maritools: { userId: 'user-1' } },
				cookies: { get: vi.fn(() => 'valid-state'), delete: vi.fn() },
				url: new URL('https://example.com/tools/schedule/google-calendar/callback?code=abc')
			})
		).rejects.toMatchObject({ status: 303, location: '/tools/schedule?gcal=error' });
		await expect(
			GET({
				locals: { maritools: { userId: 'user-1' } },
				cookies: { get: vi.fn(() => 'same-state'), delete: vi.fn() },
				url: new URL(
					'https://example.com/tools/schedule/google-calendar/callback?state=same-state&code=abc'
				)
			})
		).rejects.toMatchObject({ status: 303, location: '/tools/schedule?gcal=error' });
	});

	it('redirects to an error when connect fails', async () => {
		completeGoogleCalendarConnect.mockRejectedValueOnce(new Error('nope'));
		const { GET } = await import('./+server.js');
		await expect(
			GET({
				locals: { maritools: { userId: 'user-1' } },
				cookies: { get: vi.fn(() => 'valid-state'), delete: vi.fn() },
				url: new URL(
					'https://example.com/tools/schedule/google-calendar/callback?state=valid-state&code=abc'
				)
			})
		).rejects.toMatchObject({ status: 303, location: '/tools/schedule?gcal=error' });
	});

	it('redirects to connected when Google returns tokens', async () => {
		completeGoogleCalendarConnect.mockResolvedValueOnce(undefined);
		const { GET } = await import('./+server.js');
		await expect(
			GET({
				locals: { maritools: { userId: 'user-1' } },
				cookies: { get: vi.fn(() => 'valid-state'), delete: vi.fn() },
				url: new URL(
					'https://example.com/tools/schedule/google-calendar/callback?state=valid-state&code=abc'
				)
			})
		).rejects.toMatchObject({ status: 303, location: '/tools/schedule?gcal=connected' });
	});
});
