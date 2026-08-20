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

/** @param {{ session?: any, account?: any, runtimeError?: Error }} [options] */
function harness({ session = null, account = null, runtimeError } = {}) {
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
	const handle = createHandle({ withAuth, officialHandler, isBuilding: false });
	return { auth, findGoogleAccount, handle, officialHandler, resolve, withAuth };
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
		'/books/order-confirmation/MPC-ABCDEFGH2345'
	])('marks the sensitive route %s private even when its handler succeeds', async (path) => {
		const setup = harness();
		const response = await setup.handle({ event: event(path), resolve: setup.resolve });
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
		expect(response.headers.get('referrer-policy')).toBe('no-referrer');
		expect(response.headers.get('pragma')).toBe('no-cache');
	});

	it('leaves cache and indexing policy for ordinary public pages to the route and platform', async () => {
		const setup = harness();
		const response = await setup.handle({ event: event('/events'), resolve: setup.resolve });
		expect(response.headers.has('cache-control')).toBe(false);
		expect(response.headers.has('x-robots-tag')).toBe(false);
		expect(response.headers.has('referrer-policy')).toBe(false);
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
		expect(current.locals).toEqual({ staff: null });
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
		expect(current.locals).not.toHaveProperty('user');
		expect(current.locals).not.toHaveProperty('session');
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
