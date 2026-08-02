import { describe, expect, it, vi } from 'vitest';
import { createCheckoutOrder } from '../../books/checkout';
import { createStripeCheckoutSession, retrieveStripeCheckoutSession } from './stripe';

function validRequest(overrides = {}) {
	return {
		name: 'Ada Lovelace',
		email: 'ada@example.com',
		items: [
			{ bookId: 'antigone', quantity: 1 },
			{ bookId: 'le-petit-prince', quantity: 2 },
			{ bookId: 'antigone', quantity: 2 }
		],
		...overrides
	};
}

/**
 * @param {{ url?: unknown }} session
 */
function createStripeDouble(session) {
	const create = vi.fn().mockResolvedValue(session);

	return {
		stripe: {
			checkout: {
				sessions: { create }
			}
		},
		create
	};
}

describe('createStripeCheckoutSession', () => {
	it('creates a CAD hosted checkout session from only canonical order descriptors', async () => {
		const order = createCheckoutOrder(validRequest());
		const { stripe, create } = createStripeDouble({
			url: 'https://checkout.stripe.com/c/pay_test_book_delivery'
		});

		const url = await createStripeCheckoutSession(stripe, order, 'https://club.example');

		expect(url).toBe('https://checkout.stripe.com/c/pay_test_book_delivery');
		expect(create).toHaveBeenCalledOnce();
		expect(create).toHaveBeenCalledWith({
			mode: 'payment',
			customer_email: 'ada@example.com',
			line_items: [
				{
					price_data: {
						currency: 'cad',
						product_data: { name: 'Antigone' },
						unit_amount: 1695
					},
					quantity: 3
				},
				{
					price_data: {
						currency: 'cad',
						product_data: { name: 'Le Petit Prince' },
						unit_amount: 1895
					},
					quantity: 2
				},
				{
					price_data: {
						currency: 'cad',
						product_data: { name: 'Archambault pickup service' },
						unit_amount: 700
					},
					quantity: 1
				},
				{
					price_data: {
						currency: 'cad',
						product_data: { name: 'Renaud-Bray pickup service' },
						unit_amount: 500
					},
					quantity: 1
				},
				{
					price_data: {
						currency: 'cad',
						product_data: { name: 'Tax' },
						unit_amount: 1509
					},
					quantity: 1
				}
			],
			metadata: {
				service: 'marianopolis-book-delivery',
				fulfillment: 'manual-dashboard-purchase',
				book_count: '5'
			},
			payment_intent_data: {
				receipt_email: 'ada@example.com',
				metadata: {
					service: 'marianopolis-book-delivery',
					fulfillment: 'manual-dashboard-purchase',
					book_count: '5'
				}
			},
			success_url: 'https://club.example/books/order-confirmation?session_id={CHECKOUT_SESSION_ID}',
			cancel_url: 'https://club.example/books/checkout'
		});
	});

	it('keeps the redirect URLs on a locally safe development origin', async () => {
		const order = createCheckoutOrder(validRequest());
		const { stripe, create } = createStripeDouble({
			url: 'https://checkout.stripe.com/c/pay_test_book_delivery'
		});

		await createStripeCheckoutSession(stripe, order, 'http://localhost:5173');

		expect(create.mock.calls[0][0]).toMatchObject({
			success_url:
				'http://localhost:5173/books/order-confirmation?session_id={CHECKOUT_SESSION_ID}',
			cancel_url: 'http://localhost:5173/books/checkout'
		});
	});

	it('rejects a provider response that is not a safe HTTPS redirect URL', async () => {
		const order = createCheckoutOrder(validRequest());
		const { stripe } = createStripeDouble({ url: 'http://checkout.stripe.com/not-secure' });

		await expect(
			createStripeCheckoutSession(stripe, order, 'https://club.example')
		).rejects.toThrow(/redirect url/i);
	});

	it('rejects an unsafe origin before creating a hosted session', async () => {
		const order = createCheckoutOrder(validRequest());
		const { stripe, create } = createStripeDouble({
			url: 'https://checkout.stripe.com/c/pay_test_book_delivery'
		});

		await expect(createStripeCheckoutSession(stripe, order, 'javascript:alert(1)')).rejects.toThrow(
			/origin/i
		);

		expect(create).not.toHaveBeenCalled();
	});
});

describe('retrieveStripeCheckoutSession', () => {
	it('retrieves expanded checkout details through an injected server client', async () => {
		const retrieve = vi.fn().mockResolvedValue({
			id: 'cs_test_book_delivery',
			payment_status: 'paid'
		});
		const stripe = {
			checkout: {
				sessions: {
					create: vi.fn(),
					retrieve
				}
			}
		};

		const session = await retrieveStripeCheckoutSession(stripe, 'cs_test_book_delivery');

		expect(session).toEqual({ id: 'cs_test_book_delivery', payment_status: 'paid' });
		expect(retrieve).toHaveBeenCalledWith('cs_test_book_delivery', {
			expand: ['line_items']
		});
	});

	it('rejects malformed session IDs before calling the provider', async () => {
		const retrieve = vi.fn();
		const stripe = {
			checkout: {
				sessions: {
					create: vi.fn(),
					retrieve
				}
			}
		};

		await expect(retrieveStripeCheckoutSession(stripe, 'not-a-session-id')).rejects.toThrow(
			/session id/i
		);
		expect(retrieve).not.toHaveBeenCalled();
	});
});
