// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import {
	createStripeWebhookDescriptor,
	retrieveCheckoutEventEvidence,
	retrieveRefundEventSeed,
	retrieveRefundSessionEvidence,
	StripeWebhookEventError,
	StripeWebhookEvidenceError
} from './webhook';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const ATTEMPT_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = 'cs_test_verified_session';
const PAYMENT_INTENT_ID = 'pi_verified_payment';
const CHARGE_ID = 'ch_verified_charge';
const EVENT_ID = 'evt_verified_event';
const TOTAL_CENTS = 2500;
const EXPIRES_AT = 1786654800;

/** @param {Record<string, any>} [overrides] */
function metadata(overrides = {}) {
	return {
		service: 'marianopolis-book-delivery',
		schema_version: '1',
		order_id: ORDER_ID,
		checkout_attempt_id: ATTEMPT_ID,
		...overrides
	};
}

/** @param {string} type @param {unknown} dataObject @param {Record<string, any>} [overrides] */
function event(type, dataObject, overrides = {}) {
	return {
		id: EVENT_ID,
		object: 'event',
		type,
		livemode: false,
		data: { object: dataObject },
		...overrides
	};
}

/** @param {Record<string, any>} [overrides] */
function completedSession(overrides = {}) {
	return {
		id: SESSION_ID,
		object: 'checkout.session',
		livemode: false,
		mode: 'payment',
		status: 'complete',
		payment_status: 'paid',
		currency: 'cad',
		amount_total: TOTAL_CENTS,
		client_reference_id: ORDER_ID,
		metadata: metadata(),
		payment_method_types: ['card'],
		payment_intent: PAYMENT_INTENT_ID,
		customer_email: 'ada@example.com',
		expires_at: EXPIRES_AT,
		...overrides
	};
}

/** @param {Record<string, any>} [overrides] */
function paymentIntent(overrides = {}) {
	return {
		id: PAYMENT_INTENT_ID,
		object: 'payment_intent',
		livemode: false,
		status: 'succeeded',
		currency: 'cad',
		amount: TOTAL_CENTS,
		amount_received: TOTAL_CENTS,
		metadata: metadata(),
		latest_charge: CHARGE_ID,
		payment_method_types: ['card'],
		receipt_email: 'ada@example.com',
		...overrides
	};
}

/** @param {Record<string, any>} [overrides] */
function refundedCharge(overrides = {}) {
	return {
		id: CHARGE_ID,
		object: 'charge',
		livemode: false,
		paid: true,
		currency: 'cad',
		amount: TOTAL_CENTS,
		amount_refunded: 600,
		refunded: false,
		payment_intent: PAYMENT_INTENT_ID,
		...overrides
	};
}

/** @param {{ session?: any, intent?: any, charge?: any }} [options] */
function stripeDouble({ session = completedSession(), intent = paymentIntent(), charge } = {}) {
	const retrieveSession = vi.fn().mockResolvedValue(session);
	const retrieveIntent = vi.fn().mockResolvedValue(intent);
	const retrieveCharge = vi
		.fn()
		.mockResolvedValue(charge === undefined ? refundedCharge() : charge);
	return {
		stripe: {
			checkout: { sessions: { retrieve: retrieveSession } },
			paymentIntents: { retrieve: retrieveIntent },
			charges: { retrieve: retrieveCharge }
		},
		retrieveSession,
		retrieveIntent,
		retrieveCharge
	};
}

describe('createStripeWebhookDescriptor', () => {
	it.each([
		['checkout.session.completed', 'completed', SESSION_ID],
		['checkout.session.expired', 'expired', SESSION_ID],
		['charge.refunded', 'refunded', CHARGE_ID]
	])('accepts the handled %s event as %s', (type, kind, objectId) => {
		const descriptor = createStripeWebhookDescriptor(
			event(type, { id: objectId }),
			'sk_test_configured'
		);
		expect(descriptor).toEqual({
			id: EVENT_ID,
			type,
			mode: 'test',
			kind,
			objectId,
			environmentMatches: true
		});
	});

	it('bounds valid signed unknown and asynchronous event types without reading their data object', () => {
		const descriptor = createStripeWebhookDescriptor(
			event('payment_intent.processing', null),
			'sk_test_configured'
		);
		expect(descriptor).toEqual({
			id: EVENT_ID,
			type: 'payment_intent.processing',
			mode: 'test',
			kind: 'unsupported',
			objectId: null,
			environmentMatches: true
		});
	});

	it('marks a test/live mismatch for a bounded rejected disposition', () => {
		expect(
			createStripeWebhookDescriptor(
				event('checkout.session.completed', { id: SESSION_ID }, { livemode: true }),
				'sk_test_configured'
			).environmentMatches
		).toBe(false);
	});

	it.each([
		['a non-object event', null, 'sk_test_configured'],
		[
			'a wrong object marker',
			event('payment_intent.processing', null, { object: 'invoice' }),
			'sk_test_x'
		],
		['a malformed event id', event('payment_intent.processing', null, { id: 'bad' }), 'sk_test_x'],
		['an oversized event type', event('x'.repeat(65), null), 'sk_test_x'],
		['a blank event type', event('', null), 'sk_test_x'],
		[
			'a malformed event mode',
			event('payment_intent.processing', null, { livemode: 'no' }),
			'sk_test_x'
		],
		['a malformed Stripe key', event('payment_intent.processing', null), 'not-a-key'],
		['a non-string Stripe key', event('payment_intent.processing', null), null],
		['a missing handled data object', event('charge.refunded', null), 'sk_test_x'],
		[
			'a wrong handled object identifier',
			event('checkout.session.completed', { id: CHARGE_ID }),
			'sk_test_x'
		]
	])('rejects %s', (_label, value, key) => {
		expect(() => createStripeWebhookDescriptor(value, /** @type {any} */ (key))).toThrow(
			StripeWebhookEventError
		);
	});
});

describe('retrieveCheckoutEventEvidence', () => {
	it('retrieves and binds a paid Session and PaymentIntent outside persistence', async () => {
		const descriptor = createStripeWebhookDescriptor(
			event('checkout.session.completed', { id: SESSION_ID }),
			'sk_test_configured'
		);
		const { stripe, retrieveSession, retrieveIntent, retrieveCharge } = stripeDouble();

		const evidence = await retrieveCheckoutEventEvidence(stripe, descriptor);

		expect(evidence).toEqual({
			kind: 'completed',
			orderId: ORDER_ID,
			attemptId: ATTEMPT_ID,
			sessionId: SESSION_ID,
			paymentIntentId: PAYMENT_INTENT_ID,
			chargeId: CHARGE_ID,
			totalCents: TOTAL_CENTS,
			refundedAmountCents: 0,
			receiptEmail: 'ada@example.com',
			expiresAt: new Date(EXPIRES_AT * 1000)
		});
		expect(retrieveSession).toHaveBeenCalledWith(SESSION_ID);
		expect(retrieveIntent).toHaveBeenCalledWith(PAYMENT_INTENT_ID);
		expect(retrieveCharge).not.toHaveBeenCalled();
	});

	it('retrieves and binds an expired unpaid Session without a payment lookup', async () => {
		const descriptor = createStripeWebhookDescriptor(
			event('checkout.session.expired', { id: SESSION_ID }),
			'sk_test_configured'
		);
		const { stripe, retrieveIntent } = stripeDouble({
			session: completedSession({
				status: 'expired',
				payment_status: 'unpaid',
				payment_intent: null,
				customer_email: null
			})
		});

		expect(await retrieveCheckoutEventEvidence(stripe, descriptor)).toEqual({
			kind: 'expired',
			orderId: ORDER_ID,
			attemptId: ATTEMPT_ID,
			sessionId: SESSION_ID,
			paymentIntentId: null,
			chargeId: null,
			totalCents: TOTAL_CENTS,
			refundedAmountCents: 0,
			receiptEmail: null,
			expiresAt: new Date(EXPIRES_AT * 1000)
		});
		expect(retrieveIntent).not.toHaveBeenCalled();
	});

	it.each([
		['non-object Session', null],
		['non-object metadata', { metadata: null }],
		['wrong Session id', { id: 'cs_test_other' }],
		['wrong livemode', { livemode: true }],
		['wrong mode', { mode: 'subscription' }],
		['wrong card methods', { payment_method_types: ['card', 'link'] }],
		['wrong currency', { currency: 'usd' }],
		['wrong total', { amount_total: TOTAL_CENTS + 1 }],
		['wrong client reference', { client_reference_id: ATTEMPT_ID }],
		['wrong service metadata', { metadata: metadata({ service: 'other' }) }],
		['extra metadata', { metadata: metadata({ extra: 'no' }) }],
		['wrong completion state', { payment_status: 'unpaid' }],
		['missing PaymentIntent', { payment_intent: null }],
		['malformed expiry', { expires_at: 0 }]
	])('rejects a completed Session with %s', async (_label, overrides) => {
		const descriptor = createStripeWebhookDescriptor(
			event('checkout.session.completed', { id: SESSION_ID }),
			'sk_test_configured'
		);
		const { stripe } = stripeDouble({
			session: overrides === null ? null : completedSession(overrides)
		});
		await expect(retrieveCheckoutEventEvidence(stripe, descriptor)).rejects.toBeInstanceOf(
			StripeWebhookEvidenceError
		);
	});

	it.each([
		['non-object PaymentIntent', null],
		['wrong PaymentIntent id', { id: 'pi_other' }],
		['wrong PaymentIntent mode', { livemode: true }],
		['wrong PaymentIntent currency', { currency: 'usd' }],
		['wrong PaymentIntent amount', { amount: TOTAL_CENTS + 1 }],
		['wrong amount received', { amount_received: TOTAL_CENTS - 1 }],
		['unsettled PaymentIntent', { status: 'processing' }],
		['wrong PaymentIntent metadata', { metadata: metadata({ schema_version: '2' }) }],
		['missing latest charge', { latest_charge: null }],
		['wrong PaymentIntent methods', { payment_method_types: ['card', 'link'] }],
		['wrong receipt email shape', { receipt_email: null }]
	])('rejects %s', async (_label, overrides) => {
		const descriptor = createStripeWebhookDescriptor(
			event('checkout.session.completed', { id: SESSION_ID }),
			'sk_test_configured'
		);
		const { stripe } = stripeDouble({
			intent: overrides === null ? null : paymentIntent(overrides)
		});
		await expect(retrieveCheckoutEventEvidence(stripe, descriptor)).rejects.toBeInstanceOf(
			StripeWebhookEvidenceError
		);
	});

	it('propagates provider retrieval failures without converting them to accepted evidence', async () => {
		const providerFailure = new Error('provider unavailable');
		const descriptor = createStripeWebhookDescriptor(
			event('checkout.session.completed', { id: SESSION_ID }),
			'sk_test_configured'
		);
		const { stripe, retrieveSession } = stripeDouble();
		retrieveSession.mockRejectedValue(providerFailure);
		await expect(retrieveCheckoutEventEvidence(stripe, descriptor)).rejects.toBe(providerFailure);
	});

	it('accepts an expired Session with an already-created bound PaymentIntent', async () => {
		const descriptor = createStripeWebhookDescriptor(
			event('checkout.session.expired', { id: SESSION_ID }),
			'sk_test_configured'
		);
		const { stripe } = stripeDouble({
			session: completedSession({
				status: 'expired',
				payment_status: 'unpaid',
				payment_intent: PAYMENT_INTENT_ID,
				customer_email: null
			})
		});
		expect((await retrieveCheckoutEventEvidence(stripe, descriptor)).paymentIntentId).toBe(
			PAYMENT_INTENT_ID
		);
	});

	it('rejects a completed Session whose email does not match the PaymentIntent receipt', async () => {
		const descriptor = createStripeWebhookDescriptor(
			event('checkout.session.completed', { id: SESSION_ID }),
			'sk_test_configured'
		);
		const { stripe } = stripeDouble({
			intent: paymentIntent({ receipt_email: 'other@example.com' })
		});
		await expect(retrieveCheckoutEventEvidence(stripe, descriptor)).rejects.toBeInstanceOf(
			StripeWebhookEvidenceError
		);
	});

	it('rejects a Session identifier whose prefix disagrees with the signed event mode', async () => {
		const wrongModeSession = 'cs_live_wrong_mode';
		const descriptor = createStripeWebhookDescriptor(
			event('checkout.session.completed', { id: wrongModeSession }),
			'sk_test_configured'
		);
		const { stripe } = stripeDouble({
			session: completedSession({ id: wrongModeSession, livemode: false })
		});
		await expect(retrieveCheckoutEventEvidence(stripe, descriptor)).rejects.toBeInstanceOf(
			StripeWebhookEvidenceError
		);
	});

	it('accepts provider evidence consistently bound to live mode', async () => {
		const liveSession = 'cs_live_verified_session';
		const descriptor = createStripeWebhookDescriptor(
			event('checkout.session.completed', { id: liveSession }, { livemode: true }),
			'sk_live_configured'
		);
		const { stripe } = stripeDouble({
			session: completedSession({ id: liveSession, livemode: true }),
			intent: paymentIntent({ livemode: true })
		});
		expect(await retrieveCheckoutEventEvidence(stripe, descriptor)).toEqual(
			expect.objectContaining({ sessionId: liveSession, kind: 'completed' })
		);
	});

	it('rejects malformed clients and unsupported descriptors before retrieval', async () => {
		const unsupported = createStripeWebhookDescriptor(
			event('customer.created', null),
			'sk_test_configured'
		);
		await expect(retrieveCheckoutEventEvidence({}, unsupported)).rejects.toBeInstanceOf(
			StripeWebhookEvidenceError
		);
	});
});

describe('refund provider evidence', () => {
	it('retrieves Charge and PaymentIntent before using the stored Session binding', async () => {
		const descriptor = createStripeWebhookDescriptor(
			event('charge.refunded', { id: CHARGE_ID }),
			'sk_test_configured'
		);
		const { stripe, retrieveCharge, retrieveIntent, retrieveSession } = stripeDouble();

		const seed = await retrieveRefundEventSeed(stripe, descriptor);
		expect(seed).toEqual({
			kind: 'refunded',
			orderId: ORDER_ID,
			attemptId: ATTEMPT_ID,
			paymentIntentId: PAYMENT_INTENT_ID,
			chargeId: CHARGE_ID,
			totalCents: TOTAL_CENTS,
			refundedAmountCents: 600,
			receiptEmail: 'ada@example.com'
		});
		expect(retrieveCharge).toHaveBeenCalledWith(CHARGE_ID);
		expect(retrieveIntent).toHaveBeenCalledWith(PAYMENT_INTENT_ID);
		expect(retrieveSession).not.toHaveBeenCalled();

		const evidence = await retrieveRefundSessionEvidence(stripe, seed, SESSION_ID, descriptor);
		expect(evidence).toEqual({
			...seed,
			sessionId: SESSION_ID,
			expiresAt: new Date(EXPIRES_AT * 1000)
		});
		expect(retrieveSession).toHaveBeenCalledWith(SESSION_ID);
	});

	it.each([
		['non-object Charge', null],
		['wrong Charge id', { id: 'ch_other' }],
		['wrong livemode', { livemode: true }],
		['unpaid Charge', { paid: false }],
		['wrong currency', { currency: 'usd' }],
		['zero refund', { amount_refunded: 0 }],
		['excess refund', { amount_refunded: TOTAL_CENTS + 1 }],
		['wrong partial-refund flag', { refunded: true }],
		['wrong full-refund flag', { amount_refunded: TOTAL_CENTS, refunded: false }],
		['missing PaymentIntent', { payment_intent: null }]
	])('rejects a refunded Charge with %s', async (_label, overrides) => {
		const descriptor = createStripeWebhookDescriptor(
			event('charge.refunded', { id: CHARGE_ID }),
			'sk_test_configured'
		);
		const { stripe } = stripeDouble({
			charge: overrides === null ? null : refundedCharge(overrides)
		});
		await expect(retrieveRefundEventSeed(stripe, descriptor)).rejects.toBeInstanceOf(
			StripeWebhookEvidenceError
		);
	});

	it('rejects a Charge and PaymentIntent that do not bind to the same charge total', async () => {
		const descriptor = createStripeWebhookDescriptor(
			event('charge.refunded', { id: CHARGE_ID }),
			'sk_test_configured'
		);
		const { stripe } = stripeDouble({ intent: paymentIntent({ amount: TOTAL_CENTS + 1 }) });
		await expect(retrieveRefundEventSeed(stripe, descriptor)).rejects.toBeInstanceOf(
			StripeWebhookEvidenceError
		);
	});

	it('rejects a malformed refund client or descriptor before any provider retrieval', async () => {
		await expect(retrieveRefundEventSeed({}, /** @type {any} */ ({}))).rejects.toBeInstanceOf(
			StripeWebhookEvidenceError
		);
	});

	it('rejects a non-object refund PaymentIntent', async () => {
		const descriptor = createStripeWebhookDescriptor(
			event('charge.refunded', { id: CHARGE_ID }),
			'sk_test_configured'
		);
		const { stripe } = stripeDouble({ intent: null });
		await expect(retrieveRefundEventSeed(stripe, descriptor)).rejects.toBeInstanceOf(
			StripeWebhookEvidenceError
		);
	});

	it.each([null, 'not-a-session', 'cs_live_wrong'])(
		'rejects an invalid stored Session id %#',
		async (id) => {
			const descriptor = createStripeWebhookDescriptor(
				event('charge.refunded', { id: CHARGE_ID }),
				'sk_test_configured'
			);
			const { stripe } = stripeDouble();
			const seed = await retrieveRefundEventSeed(stripe, descriptor);
			await expect(
				retrieveRefundSessionEvidence(stripe, seed, id, descriptor)
			).rejects.toBeInstanceOf(StripeWebhookEvidenceError);
		}
	);

	it('rejects a Session that does not bind back to the refund PaymentIntent', async () => {
		const descriptor = createStripeWebhookDescriptor(
			event('charge.refunded', { id: CHARGE_ID }),
			'sk_test_configured'
		);
		const { stripe } = stripeDouble({
			session: completedSession({ payment_intent: 'pi_other' })
		});
		const seed = await retrieveRefundEventSeed(stripe, descriptor);
		await expect(
			retrieveRefundSessionEvidence(stripe, seed, SESSION_ID, descriptor)
		).rejects.toBeInstanceOf(StripeWebhookEvidenceError);
	});

	it('rejects a valid Session whose order binding differs from the refund evidence', async () => {
		const descriptor = createStripeWebhookDescriptor(
			event('charge.refunded', { id: CHARGE_ID }),
			'sk_test_configured'
		);
		const { stripe } = stripeDouble();
		const seed = await retrieveRefundEventSeed(stripe, descriptor);
		const otherOrder = '33333333-3333-4333-8333-333333333333';
		stripe.checkout.sessions.retrieve.mockResolvedValue(
			completedSession({
				client_reference_id: otherOrder,
				metadata: metadata({ order_id: otherOrder })
			})
		);
		await expect(
			retrieveRefundSessionEvidence(stripe, seed, SESSION_ID, descriptor)
		).rejects.toBeInstanceOf(StripeWebhookEvidenceError);
	});

	it('binds the refund Session livemode to the signed event and configured key', async () => {
		const descriptor = createStripeWebhookDescriptor(
			event('charge.refunded', { id: CHARGE_ID }),
			'sk_test_configured'
		);
		const { stripe } = stripeDouble({
			session: completedSession({ id: 'cs_live_wrong', livemode: true })
		});
		const seed = await retrieveRefundEventSeed(stripe, descriptor);
		await expect(
			retrieveRefundSessionEvidence(stripe, seed, 'cs_live_wrong', descriptor)
		).rejects.toBeInstanceOf(StripeWebhookEvidenceError);
	});
});
