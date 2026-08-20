import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Stripe from './stripe-sdk-double.js';

const payload = Object.freeze({
	mode: 'payment',
	payment_method_types: ['card'],
	client_reference_id: '50000000-0000-4000-8000-000000000001',
	customer_email: 'student@example.com',
	line_items: [
		{
			price_data: {
				currency: 'cad',
				product_data: { name: 'Algorithms' },
				unit_amount: 4299
			},
			quantity: 2
		}
	],
	metadata: { service: 'marianopolis-book-delivery' },
	payment_intent_data: {},
	success_url: 'http://127.0.0.1:4174/books/order-confirmation/MPC-23456789ABCD',
	cancel_url: 'http://127.0.0.1:4174/books/checkout'
});

describe('live E2E Stripe SDK double', () => {
	it('returns one deterministic hosted checkout session without network access', async () => {
		const stripe = new Stripe('sk_test_localonly');
		const first = await stripe.checkout.sessions.create(payload, {
			idempotencyKey: 'checkout-key'
		});
		const replay = await stripe.checkout.sessions.create(payload, {
			idempotencyKey: 'checkout-key'
		});

		assert.deepEqual(replay, first);
		assert.match(first.id, /^cs_test_/u);
		assert.equal(first.amount_total, 8598);
		assert.equal(first.customer_email, payload.customer_email);
		assert.equal(first.client_reference_id, payload.client_reference_id);
		assert.equal(first.url, `https://checkout.mariprogramming.dev/session/${first.id}`);
		assert.equal((await stripe.checkout.sessions.retrieve(first.id)).id, first.id);
	});
});
