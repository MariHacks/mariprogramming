// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { _createEmailedOrderAccessEndpoint } from './+server.js';

const REFERENCE = 'MPC-ABCDEFGHJK23';
const CAPABILITY = Buffer.alloc(32, 1).toString('base64url');
const ORIGIN = 'https://club.example.com';

function request(body = JSON.stringify({ capability: CAPABILITY }), origin = ORIGIN) {
	return new Request(`${ORIGIN}/books/order-confirmation/${REFERENCE}/access`, {
		method: 'POST',
		headers: { origin, 'content-type': 'application/json', 'content-length': String(body.length) },
		body
	});
}

/** @param {Record<string, any>} [overrides] */
function dependencies(overrides = {}) {
	return {
		getLaunchState: () => 'live',
		readEnvironment: () => ({
			appOrigin: ORIGIN,
			databaseUrl: 'postgresql://runtime:secret@db.example.com/books'
		}),
		runTransaction: (/** @type {Function} */ operation) => operation({ execute: vi.fn() }),
		loadConfirmation: vi.fn(async () => ({ orderReference: REFERENCE, state: 'paid' })),
		...overrides
	};
}

/** @param {Function} endpoint @param {{ request?: Request, reference?: string }} [input] */
async function call(endpoint, input = {}) {
	const cookies = { set: vi.fn() };
	const response = await endpoint({
		request: input.request ?? request(),
		params: { orderReference: input.reference ?? REFERENCE },
		cookies
	});
	return { response, cookies };
}

describe('emailed order capability exchange', () => {
	it('sets the reference-scoped secure cookie only after persisted capability verification', async () => {
		const config = dependencies();
		const { response, cookies } = await call(_createEmailedOrderAccessEndpoint(config));
		expect(response.status).toBe(204);
		expect(config.loadConfirmation).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ publicReference: REFERENCE, capability: CAPABILITY })
		);
		expect(cookies.set).toHaveBeenCalledWith(
			`__Secure-mpc_book_confirmation_${REFERENCE}`,
			CAPABILITY,
			expect.objectContaining({
				path: '/books/order-confirmation',
				secure: true,
				httpOnly: true,
				sameSite: 'lax'
			})
		);
		expect(response.headers.get('cache-control')).toContain('no-store');
		expect(response.headers.get('referrer-policy')).toBe('no-referrer');
	});

	it.each([
		['closed launch', dependencies({ getLaunchState: () => 'coming-soon' }), request(), REFERENCE],
		['wrong origin', dependencies(), request(undefined, 'https://evil.example'), REFERENCE],
		[
			'wrong media type',
			dependencies(),
			new Request(`${ORIGIN}/x`, { method: 'POST', headers: { origin: ORIGIN } }),
			REFERENCE
		],
		['invalid reference', dependencies(), request(), 'MPC-invalid'],
		['invalid body', dependencies(), request('{'), REFERENCE],
		[
			'invalid capability',
			dependencies(),
			request(JSON.stringify({ capability: 'short' })),
			REFERENCE
		],
		[
			'unknown capability',
			dependencies({ loadConfirmation: vi.fn(async () => null) }),
			request(),
			REFERENCE
		]
	])('fails closed for %s without setting a cookie', async (_label, config, input, reference) => {
		const { response, cookies } = await call(_createEmailedOrderAccessEndpoint(config), {
			request: input,
			reference
		});
		expect(response.status).toBeGreaterThanOrEqual(400);
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('rejects an oversized body before reading confirmation state', async () => {
		const config = dependencies();
		const input = request(JSON.stringify({ capability: CAPABILITY, padding: 'x'.repeat(300) }));
		const { response } = await call(_createEmailedOrderAccessEndpoint(config), { request: input });
		expect(response.status).toBe(413);
		expect(config.loadConfirmation).not.toHaveBeenCalled();
	});

	it.each([
		[
			'unavailable default environment',
			dependencies({ readEnvironment: undefined }),
			request(),
			503
		],
		[
			'environment failure',
			dependencies({
				readEnvironment: () => {
					throw new Error('unavailable');
				}
			}),
			request(),
			503
		],
		[
			'wrong declared length syntax',
			dependencies(),
			new Request(`${ORIGIN}/x`, {
				method: 'POST',
				headers: {
					origin: ORIGIN,
					'content-type': 'application/json',
					'content-length': 'invalid'
				},
				body: JSON.stringify({ capability: CAPABILITY })
			}),
			400
		]
	])('fails closed for %s', async (_label, config, input, expectedStatus) => {
		const { response, cookies } = await call(_createEmailedOrderAccessEndpoint(config), {
			request: input
		});
		expect(response.status).toBe(expectedStatus);
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('rejects a body that exceeds the byte limit when no length is declared', async () => {
		const config = dependencies();
		const input = new Request(`${ORIGIN}/x`, {
			method: 'POST',
			headers: { origin: ORIGIN, 'content-type': 'application/json' },
			body: `${JSON.stringify({ capability: CAPABILITY })}${' '.repeat(200)}`
		});
		const { response } = await call(_createEmailedOrderAccessEndpoint(config), { request: input });
		expect(response.status).toBe(413);
		expect(config.loadConfirmation).not.toHaveBeenCalled();
	});

	it('fails closed when reading the body or loading confirmation state fails', async () => {
		const unreadable = request();
		Object.defineProperty(unreadable, 'text', {
			value: vi.fn(async () => {
				throw new Error('read failed');
			})
		});
		await expect(
			call(_createEmailedOrderAccessEndpoint(dependencies()), { request: unreadable })
		).resolves.toMatchObject({ response: expect.objectContaining({ status: 400 }) });

		const { response, cookies } = await call(
			_createEmailedOrderAccessEndpoint(
				dependencies({
					runTransaction: async () => {
						throw new Error('database unavailable');
					}
				})
			)
		);
		expect(response.status).toBe(503);
		expect(cookies.set).not.toHaveBeenCalled();
	});
});
