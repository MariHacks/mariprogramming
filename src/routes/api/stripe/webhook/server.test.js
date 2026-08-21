// @ts-nocheck
// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { createStripeClient } from '$lib/server/books/stripe';
import { StripeWebhookEvidenceError as WebhookEvidenceError } from '$lib/server/books/webhook';
import { _createStripeWebhookEndpoint, POST, _drainStripeNotifications } from './+server';

const ENDPOINT_URL = 'https://club.example/api/stripe/webhook';
const WEBHOOK_SECRET = 'whsec_testwebhooksecret';
const NOW = new Date('2026-08-13T18:00:00.000Z');
const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const ATTEMPT_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = 'cs_test_verified_session';
const PAYMENT_INTENT_ID = 'pi_verified_payment';
const CHARGE_ID = 'ch_verified_charge';

/** @param {Record<string, any>} [overrides] */
function runtimeEnvironment(overrides = {}) {
	return {
		databaseUrl: 'postgresql://user:password@db.example/books',
		stripeSecretKey: 'sk_test_configured',
		stripeWebhookSecret: WEBHOOK_SECRET,
		launchState: 'coming-soon',
		...overrides
	};
}

/** @param {string} [type] @param {unknown} [object] @param {Record<string, any>} [overrides] */
function event(type = 'payment_intent.processing', object = { id: 'pi_ignored' }, overrides = {}) {
	return {
		id: 'evt_signed_test_event',
		object: 'event',
		type,
		livemode: false,
		data: { object },
		...overrides
	};
}

/**
 * @param {unknown} value
 * @param {{ payload?: string, signature?: string, headers?: Record<string, string> }} [options]
 */
function signedRequest(value, { payload, signature, headers = {} } = {}) {
	const raw = payload ?? JSON.stringify(value);
	const timestamp = Math.floor(Date.now() / 1000);
	const stripeSignature =
		signature ??
		`t=${timestamp},v1=${createHmac('sha256', WEBHOOK_SECRET)
			.update(`${timestamp}.${raw}`, 'utf8')
			.digest('hex')}`;
	return new Request(ENDPOINT_URL, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'stripe-signature': stripeSignature,
			...headers
		},
		body: raw
	});
}

/** @param {string} [kind] */
function providerEvidence(kind = 'completed') {
	return {
		kind,
		orderId: ORDER_ID,
		attemptId: ATTEMPT_ID,
		sessionId: SESSION_ID,
		paymentIntentId: kind === 'expired' ? null : PAYMENT_INTENT_ID,
		chargeId: kind === 'expired' ? null : CHARGE_ID,
		totalCents: 2500,
		refundedAmountCents: kind === 'refunded' ? 600 : 0,
		receiptEmail: kind === 'expired' ? null : 'ada@example.com',
		expiresAt: new Date('2026-08-14T18:00:00.000Z')
	};
}

function refundSeed() {
	const evidence = providerEvidence('refunded');
	return {
		kind: evidence.kind,
		orderId: evidence.orderId,
		attemptId: evidence.attemptId,
		paymentIntentId: evidence.paymentIntentId,
		chargeId: evidence.chargeId,
		totalCents: evidence.totalCents,
		refundedAmountCents: evidence.refundedAmountCents,
		receiptEmail: evidence.receiptEmail
	};
}

/** @param {Record<string, any>} [overrides] */
function createHandler(overrides = {}) {
	const stripe = createStripeClient('sk_test_configured');
	const logger = { log: vi.fn(() => true) };
	const readEnvironment = vi.fn(() => runtimeEnvironment());
	const createClient = vi.fn(() => stripe);
	const retrieveCheckoutEvidence = vi.fn(async (_stripe, descriptor) =>
		providerEvidence(descriptor.kind)
	);
	const retrieveRefundSeed = vi.fn(async () => refundSeed());
	const loadRefundTarget = vi.fn(async () => ({ sessionId: SESSION_ID }));
	const retrieveRefundSession = vi.fn(async (_stripe, seed) => ({
		...seed,
		sessionId: SESSION_ID,
		expiresAt: providerEvidence().expiresAt
	}));
	const reduceEvent = vi.fn(async (_transaction, { descriptor }) => ({
		disposition: descriptor.kind === 'unsupported' ? 'ignored_unsupported_type' : 'applied'
	}));
	const runTransaction = vi.fn(async (operation) => operation({ transaction: true }));
	const getNow = vi.fn(() => NOW);
	const consumeRateLimit = vi.fn(() => {
		throw new Error('webhooks must not use generic rate limits');
	});
	const drainNotifications = vi.fn(async () => {});
	const handler = _createStripeWebhookEndpoint({
		readEnvironment,
		createStripeClient: createClient,
		retrieveCheckoutEvidence,
		retrieveRefundSeed,
		loadRefundTarget,
		retrieveRefundSession,
		reduceEvent,
		runTransaction,
		logger,
		getNow,
		consumeRateLimit,
		drainNotifications,
		...overrides
	});
	return {
		handler,
		stripe,
		logger,
		readEnvironment,
		createClient,
		retrieveCheckoutEvidence,
		retrieveRefundSeed,
		loadRefundTarget,
		retrieveRefundSession,
		reduceEvent,
		runTransaction,
		getNow,
		consumeRateLimit,
		drainNotifications
	};
}

/** @param {(event: { request: Request, url: URL }) => Promise<Response>} handler @param {Request} request */
async function call(handler, request) {
	return handler({ request, url: new URL(ENDPOINT_URL) });
}

describe('POST /api/stripe/webhook raw verification boundary', () => {
	it('uses the official Stripe verifier over the unchanged raw bytes before acknowledging', async () => {
		const dependencies = createHandler();
		const payload = ` {\n  "id":"evt_signed_test_event", "object":"event", "type":"payment_intent.processing", "livemode":false, "data":{"object":null}\n } `;
		const response = await call(dependencies.handler, signedRequest(null, { payload }));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			received: true,
			disposition: 'ignored_unsupported_type'
		});
		expect(dependencies.reduceEvent).toHaveBeenCalledOnce();
		expect(dependencies.retrieveCheckoutEvidence).not.toHaveBeenCalled();
		expect(dependencies.consumeRateLimit).not.toHaveBeenCalled();
	});

	it('rejects one-byte mutation after signing and logs no attacker or provider data', async () => {
		const dependencies = createHandler();
		const original = JSON.stringify(event());
		const timestamp = Math.floor(Date.now() / 1000);
		const signature = `t=${timestamp},v1=${createHmac('sha256', WEBHOOK_SECRET)
			.update(`${timestamp}.${original}`, 'utf8')
			.digest('hex')}`;
		const response = await call(
			dependencies.handler,
			signedRequest(null, { payload: `${original} `, signature })
		);
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Webhook could not be verified.' });
		expect(dependencies.reduceEvent).not.toHaveBeenCalled();
		expect(dependencies.logger.log).toHaveBeenCalledWith('webhook_verification_failed', {
			route: '/api/stripe/webhook',
			reason: 'invalid_signature',
			status: 400
		});
		expect(JSON.stringify(dependencies.logger.log.mock.calls)).not.toContain(signature);
		expect(JSON.stringify(dependencies.logger.log.mock.calls)).not.toContain('pi_ignored');
	});

	it('verifies a valid signature before rejecting malformed JSON', async () => {
		const dependencies = createHandler();
		const response = await call(
			dependencies.handler,
			signedRequest(null, { payload: '{not-json' })
		);
		expect(response.status).toBe(400);
		expect(dependencies.logger.log).toHaveBeenCalledWith('webhook_verification_failed', {
			route: '/api/stripe/webhook',
			reason: 'malformed_body',
			status: 400
		});
		expect(dependencies.reduceEvent).not.toHaveBeenCalled();
	});

	it.each([
		['a missing signature', null],
		['an oversized signature', 'x'.repeat(2049)],
		['an empty signature', '']
	])('rejects %s without passing it to Stripe', async (_label, signature) => {
		const dependencies = createHandler();
		const request = signedRequest(event());
		if (signature === null) request.headers.delete('stripe-signature');
		else request.headers.set('stripe-signature', signature);
		const response = await call(dependencies.handler, request);
		expect(response.status).toBe(400);
		expect(dependencies.reduceEvent).not.toHaveBeenCalled();
	});

	it.each([
		['a non-JSON media type', { 'content-type': 'text/plain' }, 415],
		['a malformed declared length', { 'content-length': 'unknown' }, 400],
		['an oversized declared body', { 'content-length': '65537' }, 413]
	])('rejects %s before verification', async (_label, headers, status) => {
		const dependencies = createHandler();
		const response = await call(dependencies.handler, signedRequest(event(), { headers }));
		expect(response.status).toBe(status);
		expect(dependencies.createClient).not.toHaveBeenCalled();
		expect(dependencies.reduceEvent).not.toHaveBeenCalled();
	});

	it('stops and cancels a streamed body at 64 KiB before reading a sentinel chunk', async () => {
		const dependencies = createHandler();
		let sentinelRead = false;
		let cancelled = false;
		let read = 0;
		const stream = new ReadableStream(
			{
				pull(controller) {
					if (read++ === 0) {
						controller.enqueue(new Uint8Array(65537));
						return;
					}
					sentinelRead = true;
					controller.enqueue(new Uint8Array([1]));
					controller.close();
				},
				cancel() {
					cancelled = true;
				}
			},
			{ highWaterMark: 0 }
		);
		const request = new Request(
			ENDPOINT_URL,
			/** @type {RequestInit & { duplex: 'half' }} */ ({
				method: 'POST',
				headers: { 'content-type': 'application/json', 'stripe-signature': 'not-read' },
				body: stream,
				duplex: 'half'
			})
		);
		const response = await call(dependencies.handler, request);
		expect(response.status).toBe(413);
		expect(sentinelRead).toBe(false);
		expect(cancelled).toBe(true);
		expect(request.body?.locked).toBe(false);
		expect(dependencies.createClient).not.toHaveBeenCalled();
	});

	it.each([
		[
			'a missing stream',
			{
				headers: new Headers({ 'content-type': 'application/json', 'stripe-signature': 'bounded' }),
				body: null
			},
			400
		],
		[
			'an empty stream',
			new Request(ENDPOINT_URL, {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'stripe-signature': 'bounded' },
				body: ''
			}),
			400
		]
	])('rejects %s before signature verification', async (_label, request, status) => {
		const dependencies = createHandler();
		const response = await call(dependencies.handler, /** @type {any} */ (request));
		expect(response.status).toBe(status);
		expect(dependencies.createClient).not.toHaveBeenCalled();
	});

	it('rejects a non-byte stream chunk and always releases its lock', async () => {
		const reader = {
			read: vi.fn(async () => ({ done: false, value: 'not-bytes' })),
			releaseLock: vi.fn()
		};
		const request = {
			headers: new Headers({ 'content-type': 'application/json', 'stripe-signature': 'bounded' }),
			body: { getReader: () => reader }
		};
		const response = await call(createHandler().handler, /** @type {any} */ (request));
		expect(response.status).toBe(400);
		expect(reader.releaseLock).toHaveBeenCalledOnce();
	});

	it('keeps an oversized-body rejection when stream cancellation itself fails', async () => {
		const reader = {
			read: vi.fn(async () => ({ done: false, value: new Uint8Array(65537) })),
			cancel: vi.fn(async () => {
				throw new Error('cancel failed');
			}),
			releaseLock: vi.fn()
		};
		const request = {
			headers: new Headers({ 'content-type': 'application/json', 'stripe-signature': 'bounded' }),
			body: { getReader: () => reader }
		};
		const response = await call(createHandler().handler, /** @type {any} */ (request));
		expect(response.status).toBe(413);
		expect(reader.releaseLock).toHaveBeenCalledOnce();
	});

	it('contains an unexpected body-reader failure behind the bounded invalid response', async () => {
		const dependencies = createHandler();
		const request = {
			headers: new Headers({ 'content-type': 'application/json', 'stripe-signature': 'bounded' }),
			body: {
				getReader: () => {
					throw new Error('reader failed');
				}
			}
		};
		const response = await call(dependencies.handler, /** @type {any} */ (request));
		expect(response.status).toBe(400);
		expect(dependencies.logger.log).toHaveBeenCalledWith('webhook_verification_failed', {
			route: '/api/stripe/webhook',
			reason: 'malformed_body',
			status: 400
		});
	});

	it('contains logger failure on an invalid signature', async () => {
		const handler = createHandler({
			logger: {
				log: vi.fn(() => {
					throw new Error('writer failed');
				})
			}
		}).handler;
		const response = await call(handler, signedRequest(event(), { signature: 'invalid' }));
		expect(response.status).toBe(400);
	});

	it.each([
		[
			'Stripe client creation',
			{
				createStripeClient: vi.fn(() => {
					throw new Error('client unavailable');
				})
			}
		],
		[
			'the verifier runtime',
			{
				createStripeClient: vi.fn(() => ({
					webhooks: {
						constructEventAsync: vi.fn(async () => {
							throw new Error('crypto unavailable');
						})
					}
				}))
			}
		]
	])(
		'retries instead of misclassifying %s failure as an invalid signature',
		async (_label, overrides) => {
			const dependencies = createHandler(overrides);
			const response = await call(dependencies.handler, signedRequest(event()));
			expect(response.status).toBe(503);
			expect(await response.json()).toEqual({
				error: 'Webhook processing is temporarily unavailable.'
			});
		}
	);

	it('fails closed when a created client does not expose the official async verifier', async () => {
		const dependencies = createHandler({ createStripeClient: vi.fn(() => ({})) });
		const response = await call(dependencies.handler, signedRequest(event()));
		expect(response.status).toBe(503);
	});

	it('rejects invalid verified event structure without logging any payload', async () => {
		const dependencies = createHandler();
		const response = await call(
			dependencies.handler,
			signedRequest(event('payment_intent.processing', null, { id: 'invalid' }))
		);
		expect(response.status).toBe(400);
		expect(JSON.stringify(dependencies.logger.log.mock.calls)).not.toContain('invalid');
	});

	it('fails closed when the application clock is unavailable', async () => {
		const dependencies = createHandler({ getNow: vi.fn(() => new Date('invalid')) });
		const response = await call(dependencies.handler, signedRequest(event()));
		expect(response.status).toBe(503);
	});

	it('uses the production clock default when no clock is injected', async () => {
		const dependencies = createHandler({ getNow: undefined });
		const response = await call(dependencies.handler, signedRequest(event()));
		expect(response.status).toBe(200);
	});
});

describe('POST /api/stripe/webhook provider and transaction ordering', () => {
	it.each([
		['checkout.session.completed', SESSION_ID, 'completed'],
		['checkout.session.expired', SESSION_ID, 'expired']
	])(
		'retrieves %s evidence before opening the reducer transaction',
		async (type, objectId, kind) => {
			/** @type {string[]} */
			const sequence = [];
			const dependencies = createHandler({
				retrieveCheckoutEvidence: vi.fn(async () => {
					sequence.push('provider');
					return providerEvidence(kind);
				}),
				runTransaction: vi.fn(async (operation) => {
					sequence.push('tx-start');
					const result = await operation({ transaction: true });
					sequence.push('tx-commit');
					return result;
				}),
				reduceEvent: vi.fn(async () => {
					sequence.push('reduce');
					return { disposition: 'applied' };
				})
			});
			const response = await call(
				dependencies.handler,
				signedRequest(event(type, { id: objectId }))
			);
			expect(response.status).toBe(200);
			expect(sequence).toEqual(['provider', 'tx-start', 'reduce', 'tx-commit']);
		}
	);

	it('starts notification delivery only after an applied reducer transaction commits', async () => {
		const dependencies = createHandler();
		const response = await call(
			dependencies.handler,
			signedRequest(event('checkout.session.completed', { id: SESSION_ID }))
		);
		expect(response.status).toBe(200);
		expect(dependencies.drainNotifications).toHaveBeenCalledOnce();
	});

	it('does not drain notifications for duplicate completion retries', async () => {
		const dependencies = createHandler({
			reduceEvent: vi.fn(async () => ({ disposition: 'duplicate' }))
		});
		const response = await call(
			dependencies.handler,
			signedRequest(event('checkout.session.completed', { id: SESSION_ID }))
		);
		expect(response.status).toBe(200);
		expect(dependencies.drainNotifications).not.toHaveBeenCalled();
	});

	it('keeps Stripe 200 when Discord delivery throws', async () => {
		const dependencies = createHandler({
			drainNotifications: vi.fn(() => {
				throw new Error('discord down');
			})
		});
		const response = await call(
			dependencies.handler,
			signedRequest(event('checkout.session.completed', { id: SESSION_ID }))
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ received: true, disposition: 'applied' });
	});

	it('keeps Stripe 200 when the default Discord drain cannot read configuration', async () => {
		const dependencies = createHandler();
		const handler = _createStripeWebhookEndpoint({
			readEnvironment: dependencies.readEnvironment,
			createStripeClient: () => dependencies.stripe,
			retrieveCheckoutEvidence: dependencies.retrieveCheckoutEvidence,
			retrieveRefundSeed: dependencies.retrieveRefundSeed,
			loadRefundTarget: dependencies.loadRefundTarget,
			retrieveRefundSession: dependencies.retrieveRefundSession,
			reduceEvent: dependencies.reduceEvent,
			runTransaction: dependencies.runTransaction,
			logger: dependencies.logger,
			getNow: dependencies.getNow
		});
		const response = await call(
			handler,
			signedRequest(event('checkout.session.completed', { id: SESSION_ID }))
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ received: true, disposition: 'applied' });
	});

	it('drains Discord through the default Stripe helper when a webhook is configured', async () => {
		const drain = vi.fn(async () => ({}));
		const createSink = vi.fn(() => ({ deliver: vi.fn() }));
		await _drainStripeNotifications(
			() => ({
				databaseUrl: 'postgresql://db.example/books',
				appOrigin: 'https://club.example.com',
				discordWebhookUrl:
					'https://discord.com/api/webhooks/123456789012345678/testdiscordtokenvaluefortests'
			}),
			createSink,
			() => ({ drain })
		);
		expect(createSink).toHaveBeenCalledOnce();
		expect(drain).toHaveBeenCalledOnce();
		await _drainStripeNotifications(
			() => ({
				databaseUrl: 'postgresql://db.example/books',
				appOrigin: 'https://club.example.com',
				discordWebhookUrl: null
			}),
			vi.fn(),
			() => ({ drain })
		);
		expect(drain).toHaveBeenCalledTimes(2);
	});

	it('drains a Postmark confirmation after the paid reducer commits', async () => {
		const drain = vi.fn(async () => ({}));
		const createDiscord = vi.fn();
		const createRelay = vi.fn(() => ({ drain }));
		const createPostmark = vi.fn(() => ({ deliver: vi.fn() }));
		await _drainStripeNotifications(
			() => ({
				databaseUrl: 'postgresql://db.example/books',
				appOrigin: 'https://club.example.com',
				discordWebhookUrl: null,
				postmarkServerToken: '00000000-0000-4000-8000-000000000000',
				bookCheckoutCapabilityKey: 'confirmation-capability-key-with-at-least-32-characters'
			}),
			createDiscord,
			createRelay,
			createPostmark
		);
		expect(createPostmark).toHaveBeenCalledOnce();
		expect(createRelay).toHaveBeenCalledWith(
			expect.objectContaining({
				sinkName: 'postmark',
				actions: ['stripe_completed_applied']
			})
		);
		expect(drain).toHaveBeenCalledTimes(2);
	});

	it('closes refund preflight before retrieving the stored Session and starting the final reducer', async () => {
		/** @type {string[]} */
		const sequence = [];
		let transactionNumber = 0;
		const dependencies = createHandler({
			retrieveRefundSeed: vi.fn(async () => {
				sequence.push('charge-and-intent');
				return refundSeed();
			}),
			loadRefundTarget: vi.fn(async () => {
				sequence.push('preflight-read');
				return { sessionId: SESSION_ID };
			}),
			retrieveRefundSession: vi.fn(async (_stripe, seed) => {
				sequence.push('session');
				return { ...seed, sessionId: SESSION_ID, expiresAt: providerEvidence().expiresAt };
			}),
			reduceEvent: vi.fn(async () => {
				sequence.push('reduce');
				return { disposition: 'applied' };
			}),
			runTransaction: vi.fn(async (operation) => {
				transactionNumber += 1;
				sequence.push(`tx${transactionNumber}-start`);
				const result = await operation({ transaction: transactionNumber });
				sequence.push(`tx${transactionNumber}-commit`);
				return result;
			})
		});
		const response = await call(
			dependencies.handler,
			signedRequest(event('charge.refunded', { id: CHARGE_ID }))
		);
		expect(response.status).toBe(200);
		expect(sequence).toEqual([
			'charge-and-intent',
			'tx1-start',
			'preflight-read',
			'tx1-commit',
			'session',
			'tx2-start',
			'reduce',
			'tx2-commit'
		]);
	});

	it('records a provider mismatch as rejected without applying attacker-supplied facts', async () => {
		const dependencies = createHandler({
			retrieveCheckoutEvidence: vi.fn(async () => {
				throw new WebhookEvidenceError();
			}),
			reduceEvent: vi.fn(async (_transaction, input) => {
				expect(input.evidence).toBeUndefined();
				expect(input.rejection).toBe('provider_mismatch');
				return { disposition: 'rejected' };
			})
		});
		const response = await call(
			dependencies.handler,
			signedRequest(event('checkout.session.completed', { id: SESSION_ID }))
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ received: true, disposition: 'rejected' });
	});

	it('records signed test/live mismatch as rejected without provider retrieval', async () => {
		const dependencies = createHandler();
		const response = await call(
			dependencies.handler,
			signedRequest(
				event('checkout.session.completed', { id: 'cs_live_verified_session' }, { livemode: true })
			)
		);
		expect(response.status).toBe(200);
		expect(dependencies.retrieveCheckoutEvidence).not.toHaveBeenCalled();
		expect(dependencies.reduceEvent).toHaveBeenCalledWith(
			{ transaction: true },
			expect.objectContaining({ rejection: 'provider_mismatch' })
		);
	});

	it('records an unknown refund target as rejected without retrieving an unbound Session', async () => {
		const dependencies = createHandler({ loadRefundTarget: vi.fn(async () => null) });
		const response = await call(
			dependencies.handler,
			signedRequest(event('charge.refunded', { id: CHARGE_ID }))
		);
		expect(response.status).toBe(200);
		expect(dependencies.retrieveRefundSession).not.toHaveBeenCalled();
		expect(dependencies.reduceEvent).toHaveBeenCalledWith(
			{ transaction: true },
			expect.objectContaining({ rejection: 'provider_mismatch' })
		);
	});

	it.each(['duplicate', 'stale', 'rejected'])(
		'returns bounded 2xx disposition for %s',
		async (disposition) => {
			const dependencies = createHandler({
				reduceEvent: vi.fn(async () => ({ disposition }))
			});
			const response = await call(
				dependencies.handler,
				signedRequest(event('checkout.session.completed', { id: SESSION_ID }))
			);
			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({ received: true, disposition });
		}
	);

	it.each([
		[
			'Session retrieval',
			{
				retrieveCheckoutEvidence: vi.fn(async () => {
					throw new Error('provider down');
				})
			}
		],
		[
			'refund preflight database',
			{
				loadRefundTarget: vi.fn(async () => {
					throw new Error('db down');
				})
			}
		],
		[
			'final reducer database',
			{
				reduceEvent: vi.fn(async () => {
					throw new Error('rollback');
				})
			}
		]
	])(
		'returns non-2xx and exposes no provider or database detail for %s failure',
		async (label, overrides) => {
			const dependencies = createHandler(overrides);
			const request = label.startsWith('refund')
				? signedRequest(event('charge.refunded', { id: CHARGE_ID }))
				: signedRequest(event('checkout.session.completed', { id: SESSION_ID }));
			const response = await call(dependencies.handler, request);
			expect(response.status).toBe(503);
			expect(await response.text()).toBe(
				'{"error":"Webhook processing is temporarily unavailable."}'
			);
		}
	);

	it('remains independently reachable while public Book Delivery is coming soon', async () => {
		const dependencies = createHandler({
			readEnvironment: vi.fn(() => runtimeEnvironment({ launchState: 'coming-soon' }))
		});
		const response = await call(dependencies.handler, signedRequest(event()));
		expect(response.status).toBe(200);
	});

	it('reaches signature verification and reduction with only webhook credentials configured', async () => {
		const dependencies = createHandler({
			readEnvironment: undefined,
			environmentSource: {
				DATABASE_URL: runtimeEnvironment().databaseUrl,
				STRIPE_SECRET_KEY: runtimeEnvironment().stripeSecretKey,
				STRIPE_WEBHOOK_SECRET: runtimeEnvironment().stripeWebhookSecret
			}
		});
		const response = await call(dependencies.handler, signedRequest(event()));
		expect(response.status).toBe(200);
		expect(dependencies.createClient).toHaveBeenCalledOnce();
		expect(dependencies.reduceEvent).toHaveBeenCalledOnce();
	});

	it.each([
		['DATABASE_URL', undefined],
		['DATABASE_URL', 'https://db.example.com/books'],
		['STRIPE_SECRET_KEY', undefined],
		['STRIPE_SECRET_KEY', 'sk_preview_invalid'],
		['STRIPE_WEBHOOK_SECRET', undefined],
		['STRIPE_WEBHOOK_SECRET', 'webhook-secret']
	])('returns 503 when webhook-only %s is missing or invalid', async (key, value) => {
		const source = {
			DATABASE_URL: runtimeEnvironment().databaseUrl,
			STRIPE_SECRET_KEY: runtimeEnvironment().stripeSecretKey,
			STRIPE_WEBHOOK_SECRET: runtimeEnvironment().stripeWebhookSecret,
			[key]: value
		};
		const dependencies = createHandler({
			readEnvironment: undefined,
			environmentSource: source
		});
		const response = await call(dependencies.handler, signedRequest(event()));
		expect(response.status).toBe(503);
		expect(dependencies.createClient).not.toHaveBeenCalled();
		expect(dependencies.reduceEvent).not.toHaveBeenCalled();
	});

	it('fails closed for invalid runtime configuration before reading provider state', async () => {
		const dependencies = createHandler({
			readEnvironment: vi.fn(() => {
				throw new Error('secret value');
			})
		});
		const response = await call(dependencies.handler, signedRequest(event()));
		expect(response.status).toBe(503);
		expect(await response.text()).not.toContain('secret value');
		expect(dependencies.createClient).not.toHaveBeenCalled();
	});

	it('fails closed for an incomplete runtime object', async () => {
		const dependencies = createHandler({ readEnvironment: vi.fn(() => ({})) });
		const response = await call(dependencies.handler, signedRequest(event()));
		expect(response.status).toBe(503);
		expect(dependencies.createClient).not.toHaveBeenCalled();
	});

	it('fails closed when a reducer returns an unknown disposition', async () => {
		let committed = false;
		const dependencies = createHandler({
			reduceEvent: vi.fn(async () => ({ disposition: 'other' })),
			runTransaction: vi.fn(async (operation) => {
				const result = await operation({ transaction: true });
				committed = true;
				return result;
			})
		});
		const response = await call(dependencies.handler, signedRequest(event()));
		expect(response.status).toBe(503);
		expect(committed).toBe(false);
	});

	it('keeps production defaults closed when private runtime configuration is unavailable', async () => {
		const response = await call(POST, signedRequest(event()));
		expect(response.status).toBe(503);
	});
});
