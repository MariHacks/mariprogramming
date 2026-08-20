// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { CheckoutPreflightError } from '$lib/server/books/stripe';
import { CatalogueInputError } from '$lib/server/catalogue/repository';
import { CheckoutConflictError } from '$lib/server/orders/persistence';
import { _createBookCheckoutEndpoint, POST } from './+server';

const API_URL = 'https://club.example/api/book-checkout';
const APP_ORIGIN = 'https://club.example';
const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay_test_book_delivery';
const REQUEST_ID = `ckr1_${Buffer.alloc(32, 1).toString('base64url')}`;
const COURSE_ID = '22222222-2222-4222-8222-222222222222';
const BOOK_ID = '33333333-3333-4333-8333-333333333333';
const ORDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ATTEMPT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PUBLIC_REFERENCE = 'MPC-ABCDEFGHJK23';
const NOW = new Date('2026-08-13T18:00:00.000Z');

function validRequest(overrides = {}) {
	return {
		requestId: REQUEST_ID,
		name: 'Ada Lovelace',
		email: 'ada@example.com',
		courses: [
			{
				teacherSlug: 'prof-y-boulanger',
				courseId: COURSE_ID,
				items: [{ bookId: BOOK_ID, quantity: 1 }]
			}
		],
		...overrides
	};
}

function runtimeEnvironment() {
	return Object.freeze({
		appOrigin: APP_ORIGIN,
		databaseUrl: 'postgresql://user:password@db.example/prod',
		stripeSecretKey: 'sk_test_configuredvalue',
		stripeCheckoutHost: null,
		rateLimitHmacKey: 'rate-limit-secret-kept-separate-1234567890',
		bookCheckoutCapabilityKey: 'checkout-capability-secret-kept-separate-1234567890'
	});
}

function reservation(overrides = {}) {
	return Object.freeze({
		outcome: 'created',
		order: Object.freeze({
			id: ORDER_ID,
			publicReference: PUBLIC_REFERENCE,
			customerEmail: 'ada@example.com',
			currency: 'cad',
			taxCents: 150,
			totalCents: 1150,
			confirmationExpiresAt: new Date(NOW.getTime() + 86400000)
		}),
		attempt: Object.freeze({
			id: ATTEMPT_ID,
			requestFingerprint: 'f'.repeat(64),
			stripeIdempotencyKey: `mpc-book-checkout-v1:${ATTEMPT_ID}`,
			createdAt: NOW,
			status: 'created'
		}),
		lines: Object.freeze([
			Object.freeze({
				kind: 'book',
				label: 'Algorithms',
				quantity: 1,
				unitAmountCents: 1000,
				lineAmountCents: 1000
			})
		]),
		confirmationCapability: Buffer.alloc(32, 7).toString('base64url'),
		...overrides
	});
}

/** @param {unknown} body @param {{ headers?: Record<string, string> }} [options] */
function jsonRequest(body, options = {}) {
	return new Request(API_URL, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			origin: APP_ORIGIN,
			...options.headers
		},
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});
}

function createHandler(overrides = {}) {
	const stripe = { name: 'fake-stripe-client' };
	const getLaunchState = vi.fn(() => 'live');
	const readEnvironment = vi.fn(() => runtimeEnvironment());
	const createEmailBucketKey = vi.fn(() => `rl:v1:checkout_email:${'A'.repeat(43)}`);
	const createAddressBucketKey = vi.fn(() => `rl:v1:checkout_client_address:${'B'.repeat(43)}`);
	const consumeRateLimit = vi.fn(async (_transaction, { scope }) => ({
		allowed: true,
		retryAfterSeconds: 0,
		scope
	}));
	const createRepository = vi.fn(() => ({ catalogue: true }));
	const reserveAttempt = vi.fn(async () => reservation());
	const createStripeClient = vi.fn(() => stripe);
	const providerSession = Object.freeze({
		id: 'cs_test_persisted_checkout',
		url: CHECKOUT_URL,
		paymentIntentId: null,
		expiresAt: new Date(NOW.getTime() + 86400000)
	});
	const createCheckoutSession = vi.fn(async () => providerSession);
	const retrieveCheckoutSession = vi.fn(async () => providerSession);
	const persistSession = vi.fn(async () => ({ outcome: 'ready', readyAt: NOW }));
	const failAttempt = vi.fn(async () => ({ outcome: 'failed', terminalAt: NOW }));
	const runTransaction = vi.fn(async (operation) => operation({ transaction: true }));
	const getNow = vi.fn(() => NOW);
	const handler = _createBookCheckoutEndpoint({
		getLaunchState,
		readEnvironment,
		createEmailBucketKey,
		createAddressBucketKey,
		consumeRateLimit,
		createRepository,
		reserveAttempt,
		createStripeClient,
		createCheckoutSession,
		retrieveCheckoutSession,
		persistSession,
		failAttempt,
		runTransaction,
		getNow,
		...overrides
	});
	return {
		handler,
		getLaunchState,
		readEnvironment,
		createEmailBucketKey,
		createAddressBucketKey,
		consumeRateLimit,
		createRepository,
		reserveAttempt,
		createStripeClient,
		createCheckoutSession,
		retrieveCheckoutSession,
		persistSession,
		failAttempt,
		runTransaction,
		getNow,
		stripe,
		providerSession
	};
}

/** @param {Function} handler @param {Request} request */
async function call(handler, request) {
	const cookies = { set: vi.fn() };
	const response = await handler({ request, url: new URL(API_URL), cookies });
	return { response, cookies };
}

describe('POST /api/book-checkout launch and input boundary', () => {
	it('checks the launch gate before pulling the body or touching any dependency', async () => {
		let bodyWasRead = false;
		const body = new ReadableStream(
			{
				pull(controller) {
					bodyWasRead = true;
					controller.enqueue(new TextEncoder().encode(JSON.stringify(validRequest())));
					controller.close();
				}
			},
			{ highWaterMark: 0 }
		);
		const request = new Request(
			API_URL,
			/** @type {RequestInit & { duplex: 'half' }} */ ({
				method: 'POST',
				headers: { 'content-type': 'application/json', origin: APP_ORIGIN },
				body,
				duplex: 'half'
			})
		);
		const dependencies = createHandler({ getLaunchState: () => 'coming-soon' });

		const { response, cookies } = await call(dependencies.handler, request);

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ error: 'Checkout is temporarily unavailable.' });
		expect(bodyWasRead).toBe(false);
		expect(dependencies.readEnvironment).not.toHaveBeenCalled();
		expect(dependencies.runTransaction).not.toHaveBeenCalled();
		expect(dependencies.createStripeClient).not.toHaveBeenCalled();
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it.each([
		['a missing Origin', null],
		['a null Origin', 'null'],
		['a cross-site Origin', 'https://attacker.example'],
		['a path-bearing lookalike', `${APP_ORIGIN}/path`],
		['a scheme mismatch', 'http://club.example'],
		['a port mismatch', `${APP_ORIGIN}:444`],
		['a case-normalized lookalike', 'https://CLUB.example']
	])('rejects %s before reading or rate limiting', async (_label, origin) => {
		const dependencies = createHandler();
		const request = jsonRequest(validRequest());
		if (origin === null) request.headers.delete('origin');
		else request.headers.set('origin', origin);

		const { response } = await call(dependencies.handler, request);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: 'Checkout request origin is not allowed.' });
		expect(dependencies.createEmailBucketKey).not.toHaveBeenCalled();
		expect(dependencies.runTransaction).not.toHaveBeenCalled();
	});

	it.each([
		['a non-JSON media type', 'text/plain', 415, undefined],
		['an unsupported JSON parameter', 'application/json; profile=x', 415, undefined],
		['a malformed length', 'application/json', 400, 'unknown'],
		['an oversized declared body', 'application/json', 413, '16385']
	])('rejects %s with its bounded status', async (_label, contentType, status, contentLength) => {
		const dependencies = createHandler();
		const request = jsonRequest(validRequest(), {
			headers: {
				'content-type': contentType,
				...(contentLength ? { 'content-length': contentLength } : {})
			}
		});
		const { response } = await call(dependencies.handler, request);
		expect(response.status).toBe(status);
		expect(dependencies.runTransaction).not.toHaveBeenCalled();
	});

	it('accepts JSON with an explicit UTF-8 charset', async () => {
		const { handler } = createHandler();
		expect(
			(
				await call(
					handler,
					jsonRequest(validRequest(), {
						headers: { 'content-type': 'application/json; charset=utf-8' }
					})
				)
			).response.status
		).toBe(200);
	});

	it('stops and cancels a chunked body at the 16 KiB boundary', async () => {
		const dependencies = createHandler();
		const encoder = new TextEncoder();
		let sentinelRead = false;
		let cancelled = false;
		let chunk = 0;
		const body = new ReadableStream(
			{
				pull(controller) {
					if (chunk++ === 0) {
						controller.enqueue(encoder.encode('a'.repeat(16385)));
						return;
					}
					sentinelRead = true;
					controller.enqueue(encoder.encode('sentinel'));
					controller.close();
				},
				cancel() {
					cancelled = true;
				}
			},
			{ highWaterMark: 0 }
		);
		const request = new Request(
			API_URL,
			/** @type {RequestInit & { duplex: 'half' }} */ ({
				method: 'POST',
				headers: { 'content-type': 'application/json', origin: APP_ORIGIN },
				body,
				duplex: 'half'
			})
		);

		const { response } = await call(dependencies.handler, request);
		expect(response.status).toBe(413);
		expect(sentinelRead).toBe(false);
		expect(cancelled).toBe(true);
		expect(request.body?.locked).toBe(false);
		expect(dependencies.runTransaction).not.toHaveBeenCalled();
	});

	it('still rejects an oversized body when stream cancellation itself fails', async () => {
		const dependencies = createHandler();
		const reader = {
			read: vi.fn().mockResolvedValueOnce({
				done: false,
				value: new Uint8Array(16385)
			}),
			cancel: vi.fn().mockRejectedValue(new Error('cancel failed')),
			releaseLock: vi.fn()
		};
		const request = {
			headers: new Headers({ 'content-type': 'application/json', origin: APP_ORIGIN }),
			body: { getReader: () => reader }
		};

		const { response } = await call(dependencies.handler, /** @type {any} */ (request));
		expect(response.status).toBe(413);
		expect(reader.cancel).toHaveBeenCalledOnce();
		expect(reader.releaseLock).toHaveBeenCalledOnce();
	});

	it.each([
		['a null body', null],
		[
			'a non-byte stream chunk',
			{
				getReader: () => ({
					read: vi
						.fn()
						.mockResolvedValueOnce({ done: false, value: 'not bytes' })
						.mockResolvedValueOnce({ done: true }),
					releaseLock: vi.fn()
				})
			}
		],
		[
			'a body reader failure',
			{
				getReader: () => ({
					read: vi.fn().mockRejectedValue(new Error('stream failed')),
					releaseLock: vi.fn()
				})
			}
		]
	])('fails closed for %s', async (_label, body) => {
		const dependencies = createHandler();
		const request = {
			headers: new Headers({ 'content-type': 'application/json', origin: APP_ORIGIN }),
			body
		};
		const { response } = await call(dependencies.handler, /** @type {any} */ (request));
		expect(response.status).toBe(400);
		expect(dependencies.runTransaction).not.toHaveBeenCalled();
	});

	it('rejects an empty streamed body', async () => {
		const dependencies = createHandler();
		const request = {
			headers: new Headers({ 'content-type': 'application/json', origin: APP_ORIGIN }),
			body: {
				getReader: () => ({ read: vi.fn().mockResolvedValue({ done: true }), releaseLock: vi.fn() })
			}
		};
		const { response } = await call(dependencies.handler, /** @type {any} */ (request));
		expect(response.status).toBe(400);
	});

	it.each([
		['malformed JSON', '{not-json'],
		['invalid UTF-8', new Uint8Array([0xc3, 0x28])],
		['unknown fields', { ...validRequest(), totalCents: 1 }],
		[
			'too much quantity',
			validRequest({
				courses: [{ ...validRequest().courses[0], items: [{ bookId: BOOK_ID, quantity: 11 }] }]
			})
		]
	])('rejects %s before a durable rate transaction', async (_label, body) => {
		const dependencies = createHandler();
		const request =
			body instanceof Uint8Array
				? new Request(API_URL, {
						method: 'POST',
						headers: { 'content-type': 'application/json', origin: APP_ORIGIN },
						body
					})
				: jsonRequest(body);
		const { response } = await call(dependencies.handler, request);
		expect(response.status).toBe(400);
		expect(dependencies.runTransaction).not.toHaveBeenCalled();
	});

	it.each([
		['a non-string configured origin', undefined],
		['a malformed configured origin', 'not a URL'],
		['a non-origin configured URL', `${APP_ORIGIN}/path`]
	])('fails closed for %s', async (_label, appOrigin) => {
		const dependencies = createHandler({
			readEnvironment: vi.fn(() => ({ ...runtimeEnvironment(), appOrigin }))
		});
		const { response } = await call(dependencies.handler, jsonRequest(validRequest()));
		expect(response.status).toBe(503);
		expect(dependencies.runTransaction).not.toHaveBeenCalled();
	});

	it.each(['not a date', new Date('invalid')])(
		'fails closed for invalid checkout clock %#',
		async (now) => {
			const dependencies = createHandler({ getNow: vi.fn(() => now) });
			const { response } = await call(dependencies.handler, jsonRequest(validRequest()));
			expect(response.status).toBe(400);
			expect(dependencies.runTransaction).not.toHaveBeenCalled();
		}
	);
});

describe('POST /api/book-checkout durable limits and persisted checkout', () => {
	it('consumes both durable buckets and returns the longest retry window without reserving', async () => {
		const dependencies = createHandler({
			consumeRateLimit: vi
				.fn()
				.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 20 })
				.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 45 })
		});
		const { response, cookies } = await call(dependencies.handler, jsonRequest(validRequest()));

		expect(response.status).toBe(429);
		expect(response.headers.get('retry-after')).toBe('45');
		expect(await response.json()).toEqual({
			error: 'Too many checkout attempts. Try again later.'
		});
		expect(dependencies.runTransaction).toHaveBeenCalledOnce();
		expect(dependencies.reserveAttempt).not.toHaveBeenCalled();
		expect(dependencies.createStripeClient).not.toHaveBeenCalled();
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('returns 503 when durable rate persistence fails', async () => {
		const dependencies = createHandler({
			runTransaction: vi.fn(async () => {
				throw new Error('database unavailable');
			})
		});
		const { response } = await call(dependencies.handler, jsonRequest(validRequest()));
		expect(response.status).toBe(503);
		expect(dependencies.createStripeClient).not.toHaveBeenCalled();
	});

	it('returns 503 for a malformed durable rate result', async () => {
		const dependencies = createHandler({
			runTransaction: vi.fn(async () => [{ allowed: true, retryAfterSeconds: 0 }])
		});
		const { response } = await call(dependencies.handler, jsonRequest(validRequest()));
		expect(response.status).toBe(503);
		expect(dependencies.reserveAttempt).not.toHaveBeenCalled();
	});

	it('commits reservation before Stripe, commits readiness before cookie and URL', async () => {
		/** @type {string[]} */
		const sequence = [];
		const runTransaction = vi.fn(async (operation) => {
			sequence.push('tx-start');
			const result = await operation({ transaction: true });
			sequence.push('tx-commit');
			return result;
		});
		const dependencies = createHandler({
			runTransaction,
			reserveAttempt: vi.fn(async () => {
				sequence.push('reserve');
				return reservation();
			}),
			createCheckoutSession: vi.fn(async () => {
				sequence.push('stripe');
				return {
					id: 'cs_test_persisted_checkout',
					url: CHECKOUT_URL,
					paymentIntentId: null,
					expiresAt: new Date(NOW.getTime() + 86400000)
				};
			}),
			persistSession: vi.fn(async () => {
				sequence.push('ready');
				return { outcome: 'ready', readyAt: NOW };
			})
		});

		const { response, cookies } = await call(dependencies.handler, jsonRequest(validRequest()));

		expect(response.status).toBe(200);
		const responseBody = await response.json();
		expect(responseBody).toEqual({ url: CHECKOUT_URL });
		expect(sequence).toEqual([
			'tx-start',
			'tx-commit',
			'tx-start',
			'reserve',
			'tx-commit',
			'stripe',
			'tx-start',
			'ready',
			'tx-commit'
		]);
		expect(cookies.set).toHaveBeenCalledWith(
			`__Secure-mpc_book_confirmation_${PUBLIC_REFERENCE}`,
			reservation().confirmationCapability,
			expect.objectContaining({
				path: '/books/order-confirmation',
				secure: true,
				httpOnly: true,
				sameSite: 'lax'
			})
		);
		expect(JSON.stringify(responseBody)).not.toContain(reservation().confirmationCapability);
	});

	it('returns 409 for request identity conflicts without calling Stripe', async () => {
		const dependencies = createHandler({
			reserveAttempt: vi.fn(async () => {
				throw new CheckoutConflictError();
			})
		});
		const { response } = await call(dependencies.handler, jsonRequest(validRequest()));
		expect(response.status).toBe(409);
		expect(dependencies.createStripeClient).not.toHaveBeenCalled();
	});

	it('returns 400 for a stale catalogue selection without calling Stripe', async () => {
		const dependencies = createHandler({
			reserveAttempt: vi.fn(async () => {
				throw new CatalogueInputError();
			})
		});
		const { response } = await call(dependencies.handler, jsonRequest(validRequest()));
		expect(response.status).toBe(400);
		expect(dependencies.createStripeClient).not.toHaveBeenCalled();
	});

	it('redacts an unexpected reservation failure', async () => {
		const dependencies = createHandler({
			reserveAttempt: vi.fn(async () => {
				throw new Error('database secret');
			})
		});
		const { response } = await call(dependencies.handler, jsonRequest(validRequest()));
		expect(response.status).toBe(503);
		expect(await response.text()).not.toContain('database secret');
	});

	it('fails closed for a malformed reserved attempt state', async () => {
		const dependencies = createHandler({
			reserveAttempt: vi.fn(async () =>
				reservation({ attempt: Object.freeze({ ...reservation().attempt, status: 'failed' }) })
			)
		});
		const { response } = await call(dependencies.handler, jsonRequest(validRequest()));
		expect(response.status).toBe(503);
		expect(dependencies.createStripeClient).not.toHaveBeenCalled();
	});

	it('does not replay a created attempt beyond the conservative provider idempotency window', async () => {
		const staleAttempt = reservation({
			attempt: Object.freeze({
				...reservation().attempt,
				createdAt: new Date(NOW.getTime() - 24 * 60 * 60 * 1000)
			})
		});
		const dependencies = createHandler({ reserveAttempt: vi.fn(async () => staleAttempt) });
		const { response } = await call(dependencies.handler, jsonRequest(validRequest()));
		expect(response.status).toBe(503);
		expect(dependencies.createStripeClient).not.toHaveBeenCalled();
	});

	it('retrieves and revalidates an already-ready Session without replaying create', async () => {
		const readyAttempt = reservation({
			outcome: 'recovered',
			attempt: Object.freeze({
				...reservation().attempt,
				status: 'ready',
				stripeSessionId: 'cs_test_persisted_checkout',
				createdAt: new Date(NOW.getTime() - 24 * 60 * 60 * 1000)
			})
		});
		const dependencies = createHandler({
			reserveAttempt: vi.fn(async () => readyAttempt)
		});

		const { response, cookies } = await call(dependencies.handler, jsonRequest(validRequest()));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ url: CHECKOUT_URL });
		expect(dependencies.retrieveCheckoutSession).toHaveBeenCalledWith(
			dependencies.stripe,
			readyAttempt,
			expect.objectContaining({ appOrigin: APP_ORIGIN })
		);
		expect(dependencies.createCheckoutSession).not.toHaveBeenCalled();
		expect(dependencies.persistSession).toHaveBeenCalledOnce();
		expect(cookies.set).toHaveBeenCalledOnce();
	});

	it('withholds the provider URL and capability when Stripe or final persistence fails', async () => {
		for (const overrides of [
			{
				createCheckoutSession: vi.fn(async () => {
					throw new Error('indeterminate provider failure cs_secret');
				})
			},
			{
				persistSession: vi.fn(async () => {
					throw new Error('post-provider commit failed');
				})
			}
		]) {
			const dependencies = createHandler(overrides);
			const { response, cookies } = await call(dependencies.handler, jsonRequest(validRequest()));
			const body = await response.text();
			expect(response.status).toBe(503);
			expect(body).toBe('{"error":"Checkout is temporarily unavailable."}');
			expect(body).not.toContain('cs_secret');
			expect(body).not.toContain(CHECKOUT_URL);
			expect(cookies.set).not.toHaveBeenCalled();
			expect(dependencies.failAttempt).not.toHaveBeenCalled();
		}
	});

	it('atomically retires an attempt only for a proven pre-provider failure', async () => {
		const dependencies = createHandler({
			createCheckoutSession: vi.fn(async () => {
				throw new CheckoutPreflightError();
			})
		});
		const { response, cookies } = await call(dependencies.handler, jsonRequest(validRequest()));

		expect(response.status).toBe(503);
		expect(dependencies.failAttempt).toHaveBeenCalledWith(
			{ transaction: true },
			{
				orderId: ORDER_ID,
				attemptId: ATTEMPT_ID,
				requestFingerprint: 'f'.repeat(64),
				now: NOW
			}
		);
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('fails closed without disclosure if the definitive-failure transaction rolls back', async () => {
		const dependencies = createHandler({
			createCheckoutSession: vi.fn(async () => {
				throw new CheckoutPreflightError();
			}),
			failAttempt: vi.fn(async () => {
				throw new Error('failure transition rollback');
			})
		});
		const { response, cookies } = await call(dependencies.handler, jsonRequest(validRequest()));
		expect(response.status).toBe(503);
		expect(await response.text()).not.toContain('rollback');
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('withholds the provider URL and capability for a malformed provider result', async () => {
		const dependencies = createHandler({
			createCheckoutSession: vi.fn().mockResolvedValue(null)
		});
		const { response, cookies } = await call(dependencies.handler, jsonRequest(validRequest()));
		expect(response.status).toBe(503);
		expect(dependencies.persistSession).not.toHaveBeenCalled();
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it('withholds the URL if cookie issuance fails after readiness commit', async () => {
		const dependencies = createHandler();
		const cookies = {
			set: vi.fn(() => {
				throw new Error('cookie serialization failed');
			})
		};
		const response = await dependencies.handler({
			request: jsonRequest(validRequest()),
			url: new URL(API_URL),
			cookies
		});
		expect(response.status).toBe(503);
		expect(await response.text()).not.toContain(CHECKOUT_URL);
	});

	it.each([
		['a missing cookie writer', { cookies: {}, reservationOverride: {} }],
		[
			'a malformed capability',
			{ cookies: { set: vi.fn() }, reservationOverride: { confirmationCapability: null } }
		],
		[
			'an invalid capability expiry',
			{
				cookies: { set: vi.fn() },
				reservationOverride: {
					order: Object.freeze({
						...reservation().order,
						confirmationExpiresAt: new Date('invalid')
					})
				}
			}
		],
		[
			'an expired capability',
			{
				cookies: { set: vi.fn() },
				reservationOverride: {
					order: Object.freeze({
						...reservation().order,
						confirmationExpiresAt: new Date(NOW.getTime() - 1000)
					})
				}
			}
		]
	])('withholds the URL for %s after readiness', async (_label, scenario) => {
		const dependencies = createHandler({
			reserveAttempt: vi.fn(async () => reservation(scenario.reservationOverride))
		});
		const response = await dependencies.handler({
			request: jsonRequest(validRequest()),
			url: new URL(API_URL),
			cookies: /** @type {any} */ (scenario.cookies)
		});
		expect(response.status).toBe(503);
		expect(await response.text()).not.toContain(CHECKOUT_URL);
	});

	it('fails closed when runtime configuration is invalid', async () => {
		const dependencies = createHandler({
			readEnvironment: vi.fn(() => {
				throw new Error('configuration secret');
			})
		});
		const { response } = await call(dependencies.handler, jsonRequest(validRequest()));
		expect(response.status).toBe(503);
		expect(dependencies.runTransaction).not.toHaveBeenCalled();
	});

	it('keeps default server dependencies fail-closed when invoked without runtime configuration', async () => {
		const handler = _createBookCheckoutEndpoint({ getLaunchState: () => 'live' });
		const { response } = await call(handler, jsonRequest(validRequest()));
		expect(response.status).toBe(503);
	});

	it('keeps the default runtime catalogue dependency fail-closed in an unconfigured process', async () => {
		const dependencies = createHandler({ createRepository: undefined });
		const { response } = await call(dependencies.handler, jsonRequest(validRequest()));
		expect(response.status).toBe(503);
	});

	it('uses the default request clock when no test clock is injected', async () => {
		const dependencies = createHandler({
			getNow: undefined,
			reserveAttempt: vi.fn(async () =>
				reservation({
					attempt: Object.freeze({
						...reservation().attempt,
						createdAt: new Date(0)
					})
				})
			)
		});
		const { response } = await call(dependencies.handler, jsonRequest(validRequest()));
		expect(response.status).toBe(503);
	});
});

describe('production checkout gate', () => {
	it('preserves the public closed behavior before reading input or configuration', async () => {
		const request = jsonRequest(validRequest());
		const { response } = await call(POST, request);
		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ error: 'Checkout is temporarily unavailable.' });
	});
});
