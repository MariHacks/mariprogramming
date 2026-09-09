import { describe, expect, it, vi } from 'vitest';
import { createHandle } from './hooks.server.js';

function event(pathname = '/', headers = {}) {
	return /** @type {any} */ ({
		request: new Request(`https://club.example.com${pathname}`, { headers }),
		url: new URL(`https://club.example.com${pathname}`),
		locals: {}
	});
}

const approvedSession = {
	user: { id: 'user-123', email: 'team@marihacks.com', emailVerified: true },
	session: {
		id: 'session-123',
		userId: 'user-123',
		expiresAt: new Date('2030-01-01T00:00:00.000Z')
	}
};

/** @param {{ session?: any, account?: any, runtimeError?: Error, membership?: any, membershipError?: Error, provisionError?: Error }} [options] */
function harness({
	session = null,
	account = null,
	runtimeError,
	membership = { requiredFormCompletedAt: new Date('2026-09-02T12:00:00.000Z') },
	membershipError,
	provisionError
} = {}) {
	const auth = {
		api: { getSession: vi.fn(async () => session) },
		handler: vi.fn(),
		options: { baseURL: 'https://club.example.com', basePath: '/api/auth' }
	};
	const findGoogleAccount = vi.fn(async () => account);
	const withAuth = vi.fn(async (operation) => {
		if (runtimeError) throw runtimeError;
		return operation({ auth, findGoogleAccount });
	});
	const officialHandler = vi.fn(async ({ auth: forwarded, event: current, resolve }) => {
		expect(forwarded).toBe(auth);
		return resolve(current);
	});
	const resolve = vi.fn(async () => new Response('public response'));
	const getMyClubOnboarding = vi.fn(async () => {
		if (membershipError) throw membershipError;
		return membership;
	});
	const ensureMariHacksTeamProfile = vi.fn(async () => {
		if (provisionError) throw provisionError;
		return { requiredFormCompletedAt: new Date('2026-09-02T12:00:00.000Z') };
	});
	const handle = createHandle({
		withAuth,
		officialHandler,
		createClubRepository: () => ({ getMyClubOnboarding, ensureMariHacksTeamProfile }),
		isBuilding: false
	});
	return {
		auth,
		findGoogleAccount,
		ensureMariHacksTeamProfile,
		getMyClubOnboarding,
		handle,
		officialHandler,
		resolve,
		withAuth
	};
}

describe('server authentication hook', () => {
	it.each([
		'/staff',
		'/staff/orders/11111111-1111-4111-8111-111111111111',
		'/api/auth/get-session',
		'/api/book-checkout',
		'/api/stripe/webhook',
		'/api/cron/book-delivery',
		'/books/cart',
		'/books/checkout',
		'/books/order-confirmation/MPC-ABCDEFGH2345',
		'/tools/account',
		'/tools/semester'
	])('marks the sensitive route %s private even when its handler succeeds', async (path) => {
		const setup = harness();
		const response = await setup.handle({ event: event(path), resolve: setup.resolve });
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
		expect(response.headers.get('referrer-policy')).toBe('same-origin');
		expect(response.headers.get('pragma')).toBe('no-cache');
	});

	it('leaves cache and indexing policy for ordinary public pages to the route and platform', async () => {
		const setup = harness();
		const response = await setup.handle({ event: event('/events'), resolve: setup.resolve });
		expect(response.headers.has('cache-control')).toBe(false);
		expect(response.headers.has('x-robots-tag')).toBe(false);
		expect(response.headers.has('referrer-policy')).toBe(false);
	});

	it('relaxes Python runtime CSP only on PBL pages', async () => {
		const setup = harness();
		const policy = "script-src 'self'; connect-src 'self'; worker-src 'self'";
		setup.resolve.mockImplementation(async (_event, options) => {
			const html = `<meta http-equiv="content-security-policy" content="${policy}">`;
			const body = options?.transformPageChunk ? options.transformPageChunk({ html }) : html;
			return new Response(body, { headers: { 'content-security-policy': policy } });
		});
		const pbl = await setup.handle({ event: event('/pbl/science'), resolve: setup.resolve });
		expect(await pbl.text()).toContain('wasm-unsafe-eval');
		expect(pbl.headers.get('content-security-policy')).toContain('https://cdn.jsdelivr.net');
		setup.resolve.mockImplementation(async () => new Response('public response'));
		const events = await setup.handle({ event: event('/events'), resolve: setup.resolve });
		expect(setup.resolve.mock.calls.at(-1)?.[1]).toBeUndefined();
		expect(await events.text()).toBe('public response');
	});

	it('preserves downstream headers while tightening a sensitive response', async () => {
		const setup = harness();
		setup.resolve.mockResolvedValue(
			new Response('private', { headers: { 'set-cookie': 'session=kept', vary: 'accept' } })
		);
		const response = await setup.handle({ event: event('/staff'), resolve: setup.resolve });
		expect(response.headers.get('set-cookie')).toBe('session=kept');
		expect(response.headers.get('vary')).toBe('accept');
		expect(response.headers.get('cache-control')).toBe('private, no-store');
	});

	it('keeps an ordinary public request without a staff cookie independent of auth configuration', async () => {
		const setup = harness({ runtimeError: new Error('database-url-secret') });
		const current = event('/events');
		const response = await setup.handle({ event: current, resolve: setup.resolve });
		expect(await response.text()).toBe('public response');
		expect(current.locals).toEqual({ staff: null, maritools: null });
		expect(setup.withAuth).not.toHaveBeenCalled();
		expect(setup.resolve).toHaveBeenCalledWith(current);
	});

	it('keeps the exact public staff sign-in recovery page independent of auth persistence', async () => {
		const setup = harness({ runtimeError: new Error('database-url-secret') });
		const current = event('/staff/sign-in?state=reauthenticate');
		const response = await setup.handle({ event: current, resolve: setup.resolve });
		expect(await response.text()).toBe('public response');
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
		expect(setup.withAuth).not.toHaveBeenCalled();
	});

	it('calls getSession with request headers and forwards the same auth instance to the handler', async () => {
		const setup = harness();
		const current = event('/api/auth/get-session');
		await setup.handle({ event: current, resolve: setup.resolve });
		expect(setup.auth.api.getSession).toHaveBeenCalledWith({ headers: current.request.headers });
		expect(setup.officialHandler).toHaveBeenCalledWith({
			auth: setup.auth,
			event: current,
			resolve: setup.resolve,
			building: false
		});
	});

	it('rechecks the persisted Google account and stores only minimal authorized locals', async () => {
		const setup = harness({
			session: approvedSession,
			account: { providerId: 'google', accountId: 'google-subject-123', userId: 'user-123' }
		});
		const current = event('/staff', { cookie: 'mari-staff.session_token=signed-token' });
		await setup.handle({ event: current, resolve: setup.resolve });
		expect(setup.findGoogleAccount).toHaveBeenCalledWith('user-123');
		expect(current.locals.staff).toEqual({
			userId: 'user-123',
			sessionId: 'session-123',
			email: 'team@marihacks.com',
			googleSubject: 'google-subject-123',
			expiresAt: new Date('2030-01-01T00:00:00.000Z')
		});
		expect(current.locals.maritools?.email).toBe('team@marihacks.com');
		expect(current.locals).not.toHaveProperty('user');
		expect(current.locals).not.toHaveProperty('session');
	});

	it('resolves a staff cookie on sign-in so an active session can leave the gate', async () => {
		const setup = harness({
			session: approvedSession,
			account: { providerId: 'google', accountId: 'google-subject-123', userId: 'user-123' }
		});
		const current = event('/staff/sign-in', { cookie: 'mari-staff.session_token=signed-token' });
		await setup.handle({ event: current, resolve: setup.resolve });
		expect(setup.withAuth).toHaveBeenCalledOnce();
		expect(current.locals.staff?.email).toBe('team@marihacks.com');
	});

	it('skips auth work on sign-in when no session cookie is present', async () => {
		const setup = harness({ runtimeError: new Error('must not run') });
		const current = event('/staff/sign-in');
		const response = await setup.handle({ event: current, resolve: setup.resolve });
		expect(setup.withAuth).not.toHaveBeenCalled();
		expect(await response.text()).toBe('public response');
		expect(current.locals.staff).toBeNull();
	});

	it('keeps sign-in reachable when a stale cookie meets an auth outage', async () => {
		const setup = harness({ runtimeError: new Error('database-secret') });
		const current = event('/staff/sign-in', { cookie: 'mari-staff.session_token=stale' });
		const response = await setup.handle({ event: current, resolve: setup.resolve });
		expect(response.status).toBe(200);
		expect(await response.text()).toBe('public response');
		expect(current.locals.staff).toBeNull();
	});

	it('stores a student Google session without granting staff locals', async () => {
		const setup = harness({
			session: {
				user: { id: 'user-123', email: 'ada@gmail.com', emailVerified: true },
				session: {
					id: 'session-123',
					userId: 'user-123',
					expiresAt: new Date('2030-01-01T00:00:00.000Z')
				}
			},
			account: { providerId: 'google', accountId: 'google-subject-123', userId: 'user-123' }
		});
		const current = event('/tools/account', { cookie: 'mari-staff.session_token=signed-token' });
		await setup.handle({ event: current, resolve: setup.resolve });
		expect(current.locals.staff).toBeNull();
		expect(current.locals.maritools).toEqual({
			userId: 'user-123',
			sessionId: 'session-123',
			email: 'ada@gmail.com',
			googleSubject: 'google-subject-123',
			expiresAt: new Date('2030-01-01T00:00:00.000Z')
		});
	});

	it('blocks every signed-in MariTools request until onboarding is complete', async () => {
		const setup = harness({
			session: {
				user: { id: 'user-123', email: 'ada@gmail.com', emailVerified: true },
				session: approvedSession.session
			},
			account: { providerId: 'google', accountId: 'google-subject-123', userId: 'user-123' },
			membership: { requiredFormCompletedAt: null }
		});
		const current = event('/tools/schedule', {
			cookie: 'mari-staff.session_token=signed-token'
		});
		const response = await setup.handle({ event: current, resolve: setup.resolve });
		expect(response.status).toBe(303);
		expect(response.headers.get('location')).toBe('/tools/account');
		expect(setup.resolve).not.toHaveBeenCalled();
	});

	it('returns a signed-in member to the account page when onboarding status is unavailable', async () => {
		const setup = harness({
			session: {
				user: { id: 'user-123', email: 'ada@gmail.com', emailVerified: true },
				session: approvedSession.session
			},
			account: { providerId: 'google', accountId: 'google-subject-123', userId: 'user-123' },
			membershipError: new Error('database unavailable')
		});
		const current = event('/tools', {
			cookie: 'mari-staff.session_token=signed-token'
		});
		const response = await setup.handle({ event: current, resolve: setup.resolve });

		expect(response.status).toBe(303);
		expect(response.headers.get('location')).toBe('/tools/account');
		expect(setup.resolve).not.toHaveBeenCalled();
	});

	it('allows a completed member to use MariTools', async () => {
		const setup = harness({
			session: {
				user: { id: 'user-123', email: 'ada@gmail.com', emailVerified: true },
				session: approvedSession.session
			},
			account: { providerId: 'google', accountId: 'google-subject-123', userId: 'user-123' }
		});
		const current = event('/tools/schedule', {
			cookie: 'mari-staff.session_token=signed-token'
		});
		const response = await setup.handle({ event: current, resolve: setup.resolve });
		expect(response.status).toBe(200);
		expect(setup.resolve).toHaveBeenCalledOnce();
	});

	it('creates the official MariHacks profile before allowing the team account into MariTools', async () => {
		const setup = harness({
			session: approvedSession,
			account: { providerId: 'google', accountId: 'google-subject-123', userId: 'user-123' },
			membership: { requiredFormCompletedAt: new Date('2026-09-02T12:00:00.000Z') }
		});
		const current = event('/tools/schedule', {
			cookie: 'mari-staff.session_token=signed-token'
		});

		const response = await setup.handle({ event: current, resolve: setup.resolve });

		expect(response.status).toBe(200);
		expect(setup.ensureMariHacksTeamProfile).toHaveBeenCalledWith({
			userId: 'user-123',
			email: 'team@marihacks.com'
		});
		expect(setup.getMyClubOnboarding).toHaveBeenCalledWith('user-123');
	});

	it('creates the official MariHacks profile on the account landing page', async () => {
		const setup = harness({
			session: approvedSession,
			account: { providerId: 'google', accountId: 'google-subject-123', userId: 'user-123' }
		});
		const current = event('/tools/account', {
			cookie: 'mari-staff.session_token=signed-token'
		});

		const response = await setup.handle({ event: current, resolve: setup.resolve });

		expect(response.status).toBe(200);
		expect(setup.ensureMariHacksTeamProfile).toHaveBeenCalledWith({
			userId: 'user-123',
			email: 'team@marihacks.com'
		});
		expect(setup.getMyClubOnboarding).not.toHaveBeenCalled();
	});

	it('returns the official account to account setup when automatic provisioning fails', async () => {
		const setup = harness({
			session: approvedSession,
			account: { providerId: 'google', accountId: 'google-subject-123', userId: 'user-123' },
			provisionError: new Error('database unavailable')
		});
		const response = await setup.handle({
			event: event('/tools/schedule', { cookie: 'mari-staff.session_token=signed-token' }),
			resolve: setup.resolve
		});

		expect(response.status).toBe(303);
		expect(response.headers.get('location')).toBe('/tools/account');
		expect(setup.resolve).not.toHaveBeenCalled();
	});

	it('keeps the account recovery page reachable when automatic provisioning fails', async () => {
		const setup = harness({
			session: approvedSession,
			account: { providerId: 'google', accountId: 'google-subject-123', userId: 'user-123' },
			provisionError: new Error('database unavailable')
		});
		const response = await setup.handle({
			event: event('/tools/account', { cookie: 'mari-staff.session_token=signed-token' }),
			resolve: setup.resolve
		});

		expect(response.status).toBe(200);
		expect(setup.resolve).toHaveBeenCalledOnce();
	});

	it.each([
		['provider account is absent', null],
		['provider is forged', { providerId: 'github', accountId: 'subject', userId: 'user-123' }]
	])('does not authorize when %s', async (_case, account) => {
		const setup = harness({ session: approvedSession, account });
		const current = event('/staff');
		await setup.handle({ event: current, resolve: setup.resolve });
		expect(current.locals.staff).toBeNull();
	});

	it('returns a bounded unavailable response for protected auth failures', async () => {
		const setup = harness({ runtimeError: new Error('postgresql://staff:secret@database/app') });
		const response = await setup.handle({ event: event('/staff'), resolve: setup.resolve });
		expect(response.status).toBe(503);
		expect(await response.text()).toBe('Authentication service is unavailable');
		expect(setup.resolve).not.toHaveBeenCalled();
	});

	it('lets ordinary public pages continue when a stale staff cookie meets an auth outage', async () => {
		const setup = harness({ runtimeError: new Error('database-secret') });
		const current = event('/about-us', { cookie: 'mari-staff.session_token=stale' });
		const response = await setup.handle({ event: current, resolve: setup.resolve });
		expect(await response.text()).toBe('public response');
		expect(current.locals.staff).toBeNull();
	});

	it.each(['/staff', '/events'])(
		'propagates downstream %s failures and resolves exactly once',
		async (path) => {
			const setup = harness();
			const downstream = new Error('route render failed');
			setup.resolve.mockRejectedValue(downstream);
			const current = event(
				path,
				path === '/events' ? { cookie: 'mari-staff.session_token=stale' } : {}
			);
			await expect(setup.handle({ event: current, resolve: setup.resolve })).rejects.toBe(
				downstream
			);
			expect(setup.resolve).toHaveBeenCalledOnce();
		}
	);

	it('ignores malformed cookie segments instead of treating them as a session', async () => {
		const setup = harness({ runtimeError: new Error('must not run') });
		const current = event('/events', { cookie: '__Secure-mari-staff.session_token; theme=dark' });
		await setup.handle({ event: current, resolve: setup.resolve });
		expect(setup.withAuth).not.toHaveBeenCalled();
	});
});
