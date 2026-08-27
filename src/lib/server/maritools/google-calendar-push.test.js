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

	it('throws when no grant exists', async () => {
		await expect(
			resolveGoogleCalendarAccessToken(
				/** @type {any} */ ({ getGrant: vi.fn().mockResolvedValue(null) }),
				'user-1',
				{ googleClientId: 'id', googleClientSecret: 'secret' },
				vi.fn()
			)
		).rejects.toThrow('Google Calendar is not connected');
	});

	it('refreshes an expired token', async () => {
		const store = {
			getGrant: vi.fn().mockResolvedValue({
				refreshToken: 'refresh',
				accessToken: 'old',
				accessTokenExpiresAt: new Date(Date.now() - 1000)
			}),
			updateAccessToken: vi.fn()
		};
		const fetchImpl = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ access_token: 'new-token' }), { status: 200 })
		);
		await expect(
			resolveGoogleCalendarAccessToken(
				/** @type {any} */ (store),
				'user-1',
				{ googleClientId: 'id', googleClientSecret: 'secret' },
				fetchImpl
			)
		).resolves.toBe('new-token');
		expect(store.updateAccessToken).toHaveBeenCalled();
	});

	it('throws when refresh returns no access token', async () => {
		const store = {
			getGrant: vi.fn().mockResolvedValue({
				refreshToken: 'refresh',
				accessToken: null,
				accessTokenExpiresAt: null
			}),
			updateAccessToken: vi.fn()
		};
		const fetchImpl = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({}), { status: 200 })
		);
		await expect(
			resolveGoogleCalendarAccessToken(
				/** @type {any} */ (store),
				'user-1',
				{ googleClientId: 'id', googleClientSecret: 'secret' },
				fetchImpl
			)
		).rejects.toThrow('Google token refresh returned no access token');
	});
});

describe('pushScheduleToGoogleCalendar', () => {
	it('rejects a term without rules', async () => {
		const { pushScheduleToGoogleCalendar } = await import('./google-calendar-push.js');
		await expect(
			pushScheduleToGoogleCalendar({
				store: /** @type {any} */ ({}),
				userId: 'user-1',
				term: { id: 'unknown-term', classStartDate: '2026-01-01', classEndDate: '2026-04-01' },
				courses: [],
				environment: { googleClientId: 'id', googleClientSecret: 'secret', appOrigin: 'https://example.com' }
			})
		).rejects.toThrow(/calendar rules/);
	});

	it('inserts generated occurrences', async () => {
		const { pushScheduleToGoogleCalendar } = await import('./google-calendar-push.js');
		const { ACADEMIC_TERMS } = await import('$lib/maritools/term/calendar.js');
		const term = ACADEMIC_TERMS.find((entry) => entry.id === 'fall-2026');
		const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
		const store = {
			getGrant: vi.fn().mockResolvedValue({
				refreshToken: 'refresh',
				accessToken: 'cached-token',
				accessTokenExpiresAt: new Date(Date.now() + 120_000)
			})
		};
		const result = await pushScheduleToGoogleCalendar({
			store: /** @type {any} */ (store),
			userId: 'user-1',
			term,
			courses: [
				{
					title: 'Lab',
					courseCode: '101-AA1-MQ',
					section: '00001',
					teacher: 'A',
					meetings: [{ weekday: 'Mon', startTime: '08:15', endTime: '10:05', classroom: 'GYM' }]
				}
			],
			environment: { googleClientId: 'id', googleClientSecret: 'secret', appOrigin: 'https://example.com' },
			fetchImpl
		});
		expect(result.inserted).toBeGreaterThan(0);
	});
});

describe('completeGoogleCalendarConnect', () => {
	it('stores the grant when Google returns tokens', async () => {
		const { completeGoogleCalendarConnect } = await import('./google-calendar-push.js');
		const store = { upsertGrant: vi.fn() };
		const fetchImpl = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({ refresh_token: 'refresh', access_token: 'access', expires_in: 3600 }),
				{ status: 200 }
			)
		);
		await completeGoogleCalendarConnect({
			store: /** @type {any} */ (store),
			userId: 'user-1',
			code: 'code',
			environment: {
				googleClientId: 'id',
				googleClientSecret: 'secret',
				appOrigin: 'https://example.com'
			},
			fetchImpl
		});
		expect(store.upsertGrant).toHaveBeenCalled();
	});

	it('uses global fetch when no fetchImpl is provided', async () => {
		const { completeGoogleCalendarConnect } = await import('./google-calendar-push.js');
		const store = { upsertGrant: vi.fn() };
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({ refresh_token: 'refresh', access_token: 'access' }),
					{ status: 200 }
				)
			)
		);
		await completeGoogleCalendarConnect({
			store: /** @type {any} */ (store),
			userId: 'user-1',
			code: 'code',
			environment: {
				googleClientId: 'id',
				googleClientSecret: 'secret',
				appOrigin: 'https://example.com'
			}
		});
		expect(store.upsertGrant).toHaveBeenCalled();
		vi.unstubAllGlobals();
	});

	it('throws when Google omits a refresh token', async () => {
		const { completeGoogleCalendarConnect } = await import('./google-calendar-push.js');
		await expect(
			completeGoogleCalendarConnect({
				store: /** @type {any} */ ({ upsertGrant: vi.fn() }),
				userId: 'user-1',
				code: 'code',
				environment: {
					googleClientId: 'id',
					googleClientSecret: 'secret',
					appOrigin: 'https://example.com'
				},
				fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'a' }), { status: 200 }))
			})
		).rejects.toThrow('Google did not return a refresh token');
	});

	it('stores a grant without an access token', async () => {
		const { completeGoogleCalendarConnect } = await import('./google-calendar-push.js');
		const store = { upsertGrant: vi.fn() };
		await completeGoogleCalendarConnect({
			store: /** @type {any} */ (store),
			userId: 'user-1',
			code: 'code',
			environment: {
				googleClientId: 'id',
				googleClientSecret: 'secret',
				appOrigin: 'https://example.com'
			},
			fetchImpl: vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ refresh_token: 'refresh' }), { status: 200 })
			)
		});
		expect(store.upsertGrant).toHaveBeenCalledWith(
			'user-1',
			expect.objectContaining({ refreshToken: 'refresh', accessToken: null })
		);
	});

	it('uses global fetch when no fetch implementation is passed', async () => {
		const { completeGoogleCalendarConnect } = await import('./google-calendar-push.js');
		const store = { upsertGrant: vi.fn() };
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({ refresh_token: 'refresh', access_token: 'access', expires_in: 3600 }),
					{ status: 200 }
				)
			)
		);
		await completeGoogleCalendarConnect({
			store: /** @type {any} */ (store),
			userId: 'user-1',
			code: 'code',
			environment: {
				googleClientId: 'id',
				googleClientSecret: 'secret',
				appOrigin: 'https://example.com'
			}
		});
		expect(store.upsertGrant).toHaveBeenCalled();
		vi.unstubAllGlobals();
	});
});
