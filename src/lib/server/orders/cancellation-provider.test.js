// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { expireStaffCheckoutSession, StripeStaffCancellationError } from './cancellation-provider';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const ATTEMPT_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = 'cs_test_staff_cancel';
const TOTAL_CENTS = 5404;

function seed(overrides = {}) {
	return {
		orderId: ORDER_ID,
		attemptId: ATTEMPT_ID,
		expectedVersion: 4,
		attemptVersion: 1,
		sessionId: SESSION_ID,
		paymentIntentId: null,
		totalCents: TOTAL_CENTS,
		customerEmail: 'student@example.com',
		attemptStatus: 'ready',
		...overrides
	};
}

function session(overrides = {}) {
	return {
		id: SESSION_ID,
		object: 'checkout.session',
		livemode: false,
		mode: 'payment',
		status: 'open',
		payment_status: 'unpaid',
		currency: 'cad',
		amount_total: TOTAL_CENTS,
		client_reference_id: ORDER_ID,
		metadata: {
			service: 'marianopolis-book-delivery',
			schema_version: '1',
			order_id: ORDER_ID,
			checkout_attempt_id: ATTEMPT_ID
		},
		payment_method_types: ['card'],
		payment_intent: null,
		customer_email: 'student@example.com',
		expires_at: 1786654800,
		...overrides
	};
}

/** @param {{ retrieved?: unknown, expired?: unknown }} [options] */
function stripeDouble({ retrieved = session(), expired = session({ status: 'expired' }) } = {}) {
	const retrieve = vi.fn().mockResolvedValue(retrieved);
	const expire = vi.fn().mockResolvedValue(expired);
	return {
		stripe: { checkout: { sessions: { retrieve, expire } } },
		retrieve,
		expire
	};
}

describe('expireStaffCheckoutSession', () => {
	it('retrieves, validates, expires, and revalidates a ready unpaid Session', async () => {
		const { stripe, retrieve, expire } = stripeDouble();

		await expect(expireStaffCheckoutSession(stripe, 'sk_test_configured', seed())).resolves.toEqual(
			{
				orderId: ORDER_ID,
				attemptId: ATTEMPT_ID,
				sessionId: SESSION_ID,
				paymentIntentId: null,
				totalCents: TOTAL_CENTS,
				customerEmail: 'student@example.com',
				providerStatus: 'expired'
			}
		);
		expect(retrieve).toHaveBeenCalledWith(SESSION_ID);
		expect(expire).toHaveBeenCalledWith(SESSION_ID);
	});

	it('accepts an already expired provider Session idempotently without a second expire call', async () => {
		const expiredSession = session({ status: 'expired' });
		const { stripe, expire } = stripeDouble({ retrieved: expiredSession });

		await expect(
			expireStaffCheckoutSession(stripe, 'sk_test_configured', seed({ attemptStatus: 'expired' }))
		).resolves.toMatchObject({ providerStatus: 'expired' });
		expect(expire).not.toHaveBeenCalled();
	});

	it('allows an exact incomplete PaymentIntent binding on an unpaid Session', async () => {
		const intentId = 'pi_staff_unpaid';
		const { stripe } = stripeDouble({
			retrieved: session({ payment_intent: intentId }),
			expired: session({ payment_intent: intentId, status: 'expired' })
		});
		await expect(
			expireStaffCheckoutSession(stripe, 'sk_test_configured', seed({ paymentIntentId: intentId }))
		).resolves.toMatchObject({ paymentIntentId: intentId });
	});

	it.each([
		['missing checkout client', null, 'sk_test_configured', seed()],
		[
			'missing expire method',
			{ checkout: { sessions: { retrieve: vi.fn() } } },
			'sk_test_configured',
			seed()
		],
		['non-string key', stripeDouble().stripe, null, seed()],
		['malformed key', stripeDouble().stripe, 'not-a-key', seed()],
		[
			'wrong seed status',
			stripeDouble().stripe,
			'sk_test_configured',
			seed({ attemptStatus: 'created' })
		],
		[
			'wrong seed session id',
			stripeDouble().stripe,
			'sk_test_configured',
			seed({ sessionId: 'bad' })
		],
		[
			'wrong seed email',
			stripeDouble().stripe,
			'sk_test_configured',
			seed({ customerEmail: 'bad' })
		]
	])('rejects %s before provider mutation', async (_label, stripe, key, input) => {
		await expect(expireStaffCheckoutSession(stripe, key, input)).rejects.toBeInstanceOf(
			StripeStaffCancellationError
		);
	});

	it.each([
		['non-object', null],
		['wrong object', { object: 'payment_intent' }],
		['wrong id', { id: 'cs_test_other' }],
		['wrong environment', { livemode: true }],
		['wrong mode', { mode: 'subscription' }],
		['paid Session', { status: 'complete', payment_status: 'paid' }],
		['wrong payment status', { payment_status: 'no_payment_required' }],
		['wrong currency', { currency: 'usd' }],
		['wrong amount', { amount_total: TOTAL_CENTS + 1 }],
		['wrong customer', { customer_email: 'other@example.com' }],
		['wrong client reference', { client_reference_id: ATTEMPT_ID }],
		['wrong service', { metadata: { ...session().metadata, service: 'other' } }],
		['extra metadata', { metadata: { ...session().metadata, extra: 'no' } }],
		[
			'wrong attempt metadata',
			{ metadata: { ...session().metadata, checkout_attempt_id: ORDER_ID } }
		],
		['extra payment method', { payment_method_types: ['card', 'link'] }],
		['mismatched PaymentIntent', { payment_intent: 'pi_other' }],
		['missing expiry', { expires_at: null }]
	])('does not expire provider evidence with %s', async (_label, override) => {
		const retrieved = override === null ? null : session(override);
		const { stripe, expire } = stripeDouble({ retrieved });
		await expect(
			expireStaffCheckoutSession(stripe, 'sk_test_configured', seed())
		).rejects.toBeInstanceOf(StripeStaffCancellationError);
		expect(expire).not.toHaveBeenCalled();
	});

	it.each([
		['still open', {}],
		['paid after expire', { status: 'complete', payment_status: 'paid' }],
		['different Session', { id: 'cs_test_other' }],
		['changed amount', { amount_total: TOTAL_CENTS + 1 }]
	])('rejects an invalid expire response that is %s', async (_label, override) => {
		const { stripe, expire } = stripeDouble({ expired: session(override) });
		await expect(
			expireStaffCheckoutSession(stripe, 'sk_test_configured', seed())
		).rejects.toBeInstanceOf(StripeStaffCancellationError);
		expect(expire).toHaveBeenCalledOnce();
	});

	it('does not expire an open provider Session when persistence says already expired', async () => {
		const { stripe, expire } = stripeDouble();
		await expect(
			expireStaffCheckoutSession(stripe, 'sk_test_configured', seed({ attemptStatus: 'expired' }))
		).rejects.toBeInstanceOf(StripeStaffCancellationError);
		expect(expire).not.toHaveBeenCalled();
	});

	it('propagates provider transport failures without attempting another mutation', async () => {
		const failure = new Error('provider unavailable');
		const { stripe, retrieve, expire } = stripeDouble();
		retrieve.mockRejectedValue(failure);
		await expect(expireStaffCheckoutSession(stripe, 'sk_test_configured', seed())).rejects.toBe(
			failure
		);
		expect(expire).not.toHaveBeenCalled();
	});
});
