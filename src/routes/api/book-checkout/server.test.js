import { describe, expect, it, vi } from 'vitest';
import { _createBookCheckoutEndpoint } from './+server';

const API_URL = 'https://club.example/api/book-checkout';
const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay_test_book_delivery';

function validRequest(overrides = {}) {
	return {
		name: 'Ada Lovelace',
		email: 'ada@example.com',
		items: [{ bookId: 'antigone', quantity: 1 }],
		...overrides
	};
}

/**
 * @param {unknown} body
 * @param {{ headers?: Record<string, string> }} [options]
 */
function jsonRequest(body, options = {}) {
	return new Request(API_URL, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			origin: 'https://club.example',
			...options.headers
		},
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});
}

function createHandler(overrides = {}) {
	const stripe = { name: 'fake-stripe-client' };
	const getSecretKey = vi.fn(() => 'configured-key');
	const createStripeClient = vi.fn(() => stripe);
	const createCheckoutSession = vi.fn(async () => CHECKOUT_URL);
	const handler = _createBookCheckoutEndpoint({
		getSecretKey,
		createStripeClient,
		createCheckoutSession,
		...overrides
	});

	return { handler, getSecretKey, createStripeClient, createCheckoutSession, stripe };
}

/**
 * @param {(event: { request: Request, url: URL }) => Promise<Response>} handler
 * @param {Request} request
 */
async function call(handler, request) {
	return handler({ request, url: new URL(API_URL) });
}

describe('POST /api/book-checkout', () => {
	it('rejects a browser-supplied total before creating a checkout session', async () => {
		const { handler, createCheckoutSession, createStripeClient, stripe } = createHandler();
		const request = jsonRequest(
			validRequest({
				items: [{ bookId: 'antigone', quantity: 2 }],
				totalCents: 1
			})
		);

		const response = await call(handler, request);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Checkout request is invalid.' });
		expect(createStripeClient).not.toHaveBeenCalled();
		expect(createCheckoutSession).not.toHaveBeenCalled();
		expect(stripe).toEqual({ name: 'fake-stripe-client' });
	});

	it('creates a checkout session from IDs, quantities, and guest contact only', async () => {
		const { handler, createCheckoutSession, createStripeClient, stripe } = createHandler();

		const response = await call(handler, jsonRequest(validRequest()));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ url: CHECKOUT_URL });
		expect(createStripeClient).toHaveBeenCalledWith('configured-key');
		expect(createCheckoutSession).toHaveBeenCalledWith(
			stripe,
			expect.objectContaining({
				guest: { name: 'Ada Lovelace', email: 'ada@example.com' },
				summary: expect.objectContaining({
					bookSubtotalCents: 1695,
					taxCents: 359,
					totalCents: 2754
				})
			}),
			'https://club.example'
		);
	});

	it.each([
		['malformed JSON', '{not json'],
		['an empty basket', validRequest({ items: [] })],
		['an unknown book', validRequest({ items: [{ bookId: 'not-in-catalogue', quantity: 1 }] })],
		[
			'a client supplied price',
			validRequest({ items: [{ bookId: 'antigone', quantity: 1, priceCents: 1 }] })
		]
	])('rejects %s without creating a Stripe session', async (_case, body) => {
		const { handler, createStripeClient, createCheckoutSession } = createHandler();

		const response = await call(handler, jsonRequest(body));

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Checkout request is invalid.' });
		expect(createStripeClient).not.toHaveBeenCalled();
		expect(createCheckoutSession).not.toHaveBeenCalled();
	});

	it('rejects a non-JSON or oversized request body', async () => {
		const { handler, createStripeClient, createCheckoutSession } = createHandler();
		const nonJson = new Request(API_URL, {
			method: 'POST',
			headers: { origin: 'https://club.example', 'content-type': 'text/plain' },
			body: 'not-json'
		});
		const oversized = jsonRequest({ payload: 'a'.repeat(17000) });

		for (const request of [nonJson, oversized]) {
			const response = await call(handler, request);

			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({ error: 'Checkout request is invalid.' });
		}

		expect(createStripeClient).not.toHaveBeenCalled();
		expect(createCheckoutSession).not.toHaveBeenCalled();
	});

	it('rejects a supplied cross-origin request before reading payment input', async () => {
		const { handler, createStripeClient, createCheckoutSession } = createHandler();
		const request = jsonRequest(validRequest(), {
			headers: { origin: 'https://untrusted.example' }
		});

		const response = await call(handler, request);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: 'Checkout request origin is not allowed.' });
		expect(createStripeClient).not.toHaveBeenCalled();
		expect(createCheckoutSession).not.toHaveBeenCalled();
	});

	it('returns a deliberate unavailable response when Stripe is not configured', async () => {
		const { handler, createStripeClient, createCheckoutSession } = createHandler({
			getSecretKey: () => ''
		});

		const response = await call(handler, jsonRequest(validRequest()));

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ error: 'Card checkout is temporarily unavailable.' });
		expect(createStripeClient).not.toHaveBeenCalled();
		expect(createCheckoutSession).not.toHaveBeenCalled();
	});

	it('does not expose provider failures or configuration values', async () => {
		const privateConfigurationValue = 'configuration-value-that-must-not-be-returned';
		const { handler } = createHandler({
			getSecretKey: () => privateConfigurationValue,
			createCheckoutSession: async () => {
				throw new Error(`Provider refused ${privateConfigurationValue}`);
			}
		});

		const response = await call(handler, jsonRequest(validRequest()));
		const body = await response.text();

		expect(response.status).toBe(502);
		expect(body).toBe('{"error":"Card checkout is temporarily unavailable."}');
		expect(body).not.toContain(privateConfigurationValue);
		expect(body).not.toContain('Provider refused');
	});

	it('does not redirect when the checkout provider returns a malformed session URL', async () => {
		const { handler } = createHandler({
			createCheckoutSession: async () => 'http://checkout.stripe.com/not-secure'
		});

		const response = await call(handler, jsonRequest(validRequest()));

		expect(response.status).toBe(502);
		expect(await response.json()).toEqual({ error: 'Card checkout is temporarily unavailable.' });
	});
});
