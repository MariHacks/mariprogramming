import { describe, expect, it, vi } from 'vitest';
import { _createOrderConfirmationLoader, load, prerender } from './+page.server.js';

const REFERENCE = 'MPC-ABCDEFGHJK23';
const CAPABILITY = Buffer.alloc(32, 7).toString('base64url');
const COOKIE_NAME = `__Secure-mpc_book_confirmation_${REFERENCE}`;
const NOW = new Date('2026-08-13T18:00:00.000Z');
const persistedConfirmation = Object.freeze({
	state: 'paid',
	orderReference: REFERENCE,
	receiptEmail: 'a***@example.com',
	currency: 'cad',
	fulfillmentStatus: 'unstarted',
	bookSubtotalCents: 1800,
	serviceFeeCents: 500,
	taxCents: 345,
	totalCents: 2645,
	refundedAmountCents: 0,
	books: [],
	fees: [],
	browserCleanup: null
});

/** @param {{ reference?: string, capability?: string, url?: string }} [options] */
function event(options = {}) {
	const reference = Object.prototype.hasOwnProperty.call(options, 'reference')
		? options.reference
		: REFERENCE;
	const capability = Object.prototype.hasOwnProperty.call(options, 'capability')
		? options.capability
		: CAPABILITY;
	const url = options.url;
	const headers = vi.fn();
	return {
		params: reference === undefined ? {} : { orderReference: reference },
		cookies: { get: vi.fn((name) => (name === COOKIE_NAME ? capability : undefined)) },
		parent: vi.fn().mockResolvedValue({ launchState: 'live' }),
		setHeaders: headers,
		url: new URL(url ?? `https://club.example/books/order-confirmation/${REFERENCE}`),
		headers
	};
}

function dependencies(overrides = {}) {
	const transaction = { execute: vi.fn() };
	return {
		readEnvironment: vi.fn(() => ({ databaseUrl: 'postgresql://runtime' })),
		runTransaction: vi.fn((operation) => operation(transaction)),
		loadConfirmation: vi.fn().mockResolvedValue(persistedConfirmation),
		getNow: vi.fn(() => NOW),
		...overrides
	};
}

describe('order confirmation server load', () => {
	it('is never prerendered', () => {
		expect(prerender).toBe(false);
		expect(typeof load).toBe('function');
	});

	it('awaits the launch boundary before reading a cookie, configuration, or database', async () => {
		const blocked = event();
		blocked.parent.mockRejectedValue(Object.assign(new Error('redirect'), { status: 303 }));
		const deps = dependencies();
		const loader = _createOrderConfirmationLoader(deps);

		await expect(loader(blocked)).rejects.toMatchObject({ status: 303 });
		expect(blocked.cookies.get).not.toHaveBeenCalled();
		expect(deps.readEnvironment).not.toHaveBeenCalled();
		expect(deps.runTransaction).not.toHaveBeenCalled();
	});

	it('returns only the capability-authorized persisted receipt', async () => {
		const request = event({
			url: `https://club.example/books/order-confirmation/${REFERENCE}?session_id=cs_test_ignored`
		});
		const deps = dependencies();
		const loader = _createOrderConfirmationLoader(deps);

		await expect(loader(request)).resolves.toEqual({ confirmation: persistedConfirmation });
		expect(request.cookies.get).toHaveBeenCalledWith(COOKIE_NAME);
		expect(deps.loadConfirmation).toHaveBeenCalledWith(expect.anything(), {
			publicReference: REFERENCE,
			capability: CAPABILITY,
			now: NOW
		});
		expect(deps.runTransaction).toHaveBeenCalledWith(expect.any(Function), {
			databaseUrl: 'postgresql://runtime'
		});
		expect(JSON.stringify(deps.loadConfirmation.mock.calls)).not.toContain('cs_test_ignored');
	});

	it.each([
		['a missing route reference', { reference: undefined }],
		['a malformed route reference', { reference: 'MPC-invalid' }],
		['a missing capability cookie', { capability: undefined }],
		['a malformed capability cookie', { capability: 'not-a-capability' }]
	])(
		'returns one generic recovery model for %s before database access',
		async (_label, options) => {
			const request = event(options);
			const deps = dependencies();
			const loader = _createOrderConfirmationLoader(deps);

			await expect(loader(request)).resolves.toEqual({
				confirmation: { status: 'unavailable', returnPath: '/books/cart' }
			});
			expect(deps.readEnvironment).not.toHaveBeenCalled();
			expect(deps.runTransaction).not.toHaveBeenCalled();
		}
	);

	it('uses generic recovery when cookie access fails', async () => {
		const request = event();
		request.cookies.get.mockImplementation(() => {
			throw new Error('cookie unavailable');
		});
		const deps = dependencies();
		const loader = _createOrderConfirmationLoader(deps);

		await expect(loader(request)).resolves.toEqual({
			confirmation: { status: 'unavailable', returnPath: '/books/cart' }
		});
		expect(deps.runTransaction).not.toHaveBeenCalled();
	});

	it.each([
		['a cross-order or unknown capability', null],
		['database unavailability', new Error('sensitive database detail')],
		['a malformed repository result', { state: 'invented' }]
	])('uses the same generic recovery model for %s', async (_label, result) => {
		const request = event();
		const loadConfirmation = vi.fn(async () => {
			if (result instanceof Error) throw result;
			return result;
		});
		const loader = _createOrderConfirmationLoader(dependencies({ loadConfirmation }));

		const response = await loader(request);

		expect(response).toEqual({
			confirmation: { status: 'unavailable', returnPath: '/books/cart' }
		});
		expect(JSON.stringify(response)).not.toContain('sensitive database detail');
	});

	it('sets private no-cache, no-store, noindex, and no-referrer policy for every rendered state', async () => {
		for (const loadConfirmation of [
			vi.fn().mockResolvedValue(persistedConfirmation),
			vi.fn().mockResolvedValue(null),
			vi.fn().mockRejectedValue(new Error('unavailable'))
		]) {
			const request = event();
			const loader = _createOrderConfirmationLoader(dependencies({ loadConfirmation }));

			await loader(request);

			expect(request.headers).toHaveBeenCalledWith({
				'cache-control': 'private, no-cache, no-store, max-age=0, must-revalidate',
				expires: '0',
				pragma: 'no-cache',
				'referrer-policy': 'no-referrer',
				'x-robots-tag': 'noindex, nofollow'
			});
		}
	});
});
