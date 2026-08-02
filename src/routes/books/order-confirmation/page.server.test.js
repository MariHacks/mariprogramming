import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/books/stripe', () => ({
	createStripeClient: vi.fn(),
	retrieveStripeCheckoutSession: vi.fn()
}));

import { createStripeClient, retrieveStripeCheckoutSession } from '$lib/server/books/stripe';
import { load, prerender } from './+page.server.js';

const SESSION_ID = 'cs_test_order_confirmation_123';
const stripeClient = /** @type {ReturnType<typeof createStripeClient>} */ (
	/** @type {unknown} */ ({
		checkout: {
			sessions: {
				create: vi.fn(),
				retrieve: vi.fn()
			}
		}
	})
);
const mockCreateStripeClient = vi.mocked(createStripeClient);
const mockRetrieveStripeCheckoutSession = vi.mocked(retrieveStripeCheckoutSession);

/** @param {string | undefined} [sessionId] */
function confirmationEvent(sessionId) {
	const url = new URL('https://club.example/books/order-confirmation');
	if (sessionId !== undefined) {
		url.searchParams.set('session_id', sessionId);
	}

	return { url };
}

function paidSession(overrides = {}) {
	return {
		id: SESSION_ID,
		payment_status: 'paid',
		customer_email: 'maya.chen@marianopolis.edu',
		customer_details: { email: 'maya.chen@marianopolis.edu' },
		line_items: {
			object: 'list',
			data: [
				{
					id: 'li_book_123',
					description: 'Le Petit Prince',
					quantity: 2,
					amount_subtotal: 3790,
					amount_total: 3790,
					currency: 'cad',
					price: { id: 'price_book_123', unit_amount: 1895 }
				},
				{
					id: 'li_fee_123',
					description: 'Renaud-Bray pickup service',
					quantity: 1,
					amount_subtotal: 500,
					amount_total: 500,
					currency: 'cad',
					price: { id: 'price_fee_123', unit_amount: 500 }
				}
			]
		},
		metadata: { internal_note: 'must not reach the browser' },
		payment_intent: { id: 'pi_sensitive_123' },
		...overrides
	};
}

beforeEach(() => {
	mockCreateStripeClient.mockReset();
	mockRetrieveStripeCheckoutSession.mockReset();
	mockCreateStripeClient.mockReturnValue(stripeClient);
});

describe('order confirmation server load', () => {
	it('is never prerendered', () => {
		expect(prerender).toBe(false);
	});

	it('returns a minimal paid display model only after a verified paid session', async () => {
		mockRetrieveStripeCheckoutSession.mockResolvedValue(paidSession());

		const result = await load(confirmationEvent(SESSION_ID));

		expect(result).toEqual({
			confirmation: {
				status: 'paid',
				orderReference: SESSION_ID,
				receiptEmail: 'maya.chen@marianopolis.edu',
				lineItems: [
					{ title: 'Le Petit Prince', quantity: 2 },
					{ title: 'Renaud-Bray pickup service', quantity: 1 }
				]
			}
		});
		expect(mockRetrieveStripeCheckoutSession).toHaveBeenCalledWith(stripeClient, SESSION_ID);
	});

	it.each([
		['a missing session ID', undefined, 'missing'],
		['a malformed session ID', 'not-a-checkout-session', 'invalid'],
		['an oversized session ID', `cs_${'a'.repeat(254)}`, 'invalid']
	])(
		'returns a safe recovery model for %s without calling Stripe',
		async (_case, sessionId, reason) => {
			const result = await load(confirmationEvent(sessionId));

			expect(result).toEqual({
				confirmation: { status: 'recovery', reason, returnPath: '/books/cart' }
			});
			expect(mockCreateStripeClient).not.toHaveBeenCalled();
			expect(mockRetrieveStripeCheckoutSession).not.toHaveBeenCalled();
		}
	);

	it('keeps an unpaid session in recovery even when the session is otherwise complete', async () => {
		mockRetrieveStripeCheckoutSession.mockResolvedValue(
			paidSession({ payment_status: 'unpaid', status: 'complete' })
		);

		const result = await load(confirmationEvent(SESSION_ID));

		expect(result).toEqual({
			confirmation: { status: 'recovery', reason: 'unpaid', returnPath: '/books/cart' }
		});
	});

	it('keeps an expired Checkout Session in a distinct non-success recovery state', async () => {
		mockRetrieveStripeCheckoutSession.mockResolvedValue(
			paidSession({ payment_status: 'unpaid', status: 'expired' })
		);

		const result = await load(confirmationEvent(SESSION_ID));

		expect(result).toEqual({
			confirmation: { status: 'recovery', reason: 'expired', returnPath: '/books/cart' }
		});
	});

	it('maps unavailable, expired, and provider-error sessions to a non-success response', async () => {
		for (const providerResult of [null, new Error('provider detail must stay private')]) {
			mockRetrieveStripeCheckoutSession.mockReset();
			mockRetrieveStripeCheckoutSession.mockImplementation(async () => {
				if (providerResult instanceof Error) throw providerResult;
				return providerResult;
			});

			const result = await load(confirmationEvent(SESSION_ID));
			const serialized = JSON.stringify(result);

			expect(result).toEqual({
				confirmation: { status: 'recovery', reason: 'unavailable', returnPath: '/books/cart' }
			});
			expect(serialized).not.toContain('provider detail');
		}
	});

	it('does not accept a paid response whose session identity differs from the requested ID', async () => {
		mockRetrieveStripeCheckoutSession.mockResolvedValue(
			paidSession({ id: 'cs_test_different_session_456' })
		);

		const result = await load(confirmationEvent(SESSION_ID));

		expect(result).toEqual({
			confirmation: { status: 'recovery', reason: 'unavailable', returnPath: '/books/cart' }
		});
	});
});
