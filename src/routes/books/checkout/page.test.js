import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOOK_CART_CONTEXT_KEY } from '$lib/books/cart-context';
import { createBookCartStore } from '$lib/books/cart-store';
import { clubContent } from '$lib/content/club';
import CheckoutPage from './+page.svelte';

function createMemoryStorage() {
	const entries = new Map();

	return {
		/** @param {string} key */
		getItem(key) {
			return entries.get(key) ?? null;
		},
		/** @param {string} key @param {string} value */
		setItem(key, value) {
			entries.set(key, String(value));
		}
	};
}

function createTestCart() {
	return createBookCartStore('checkout-page-test-cart', createMemoryStorage());
}

/** @param {ReturnType<typeof createTestCart>} [cart] */
function renderCheckout(cart = createTestCart()) {
	const view = render(CheckoutPage, {
		context: new Map([[BOOK_CART_CONTEXT_KEY, cart]])
	});

	return { ...view, cart };
}

/** @param {unknown} body @param {number} [status] */
function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

async function submitGuestDetails() {
	await fireEvent.input(screen.getByRole('textbox', { name: 'Name for pickup' }), {
		target: { value: '  Maya   Chen  ' }
	});
	await fireEvent.input(screen.getByRole('textbox', { name: 'Email for receipt' }), {
		target: { value: '  MAYA.CHEN@MARIANOPOLIS.EDU  ' }
	});
	await fireEvent.submit(screen.getByRole('form', { name: 'Guest details' }));
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('Book Delivery order review', () => {
	it('keeps an empty Book Delivery cart out of checkout and points back to the cart', () => {
		const { container } = renderCheckout();

		expect(screen.getByRole('heading', { level: 1, name: 'Your cart is empty' })).toBeVisible();
		expect(screen.getByRole('link', { name: 'Return to cart' })).toHaveAttribute(
			'href',
			'/books/cart'
		);
		expect(screen.queryByRole('form', { name: 'Guest details' })).not.toBeInTheDocument();
		expect(screen.queryByRole('complementary', { name: 'Order summary' })).not.toBeInTheDocument();
		expect(screen.queryByRole('region', { name: 'Pickup location' })).not.toBeInTheDocument();
		expect(container).not.toHaveTextContent(/secure payment|wayne|map|e-transfer/i);
		expect(document.title).toBe(`Order review | ${clubContent.name}`);
	});

	it('composes one guest-first order review with canonical totals and pickup context', () => {
		const cart = createTestCart();
		cart.setQuantity('le-petit-prince', 1);
		const { container } = renderCheckout(cart);
		const status = container.querySelector('[aria-live="polite"][aria-atomic="true"]');

		expect(screen.getAllByRole('heading', { level: 1, name: 'Order review' })).toHaveLength(1);
		expect(screen.getByRole('form', { name: 'Guest details' })).toBeVisible();
		expect(screen.getByRole('complementary', { name: 'Order summary' })).toBeVisible();
		expect(screen.getByRole('region', { name: 'Pickup location' })).toBeVisible();
		expect(screen.getByText('Book subtotal')).toBeVisible();
		expect(screen.getByText('$18.95')).toBeVisible();
		expect(screen.getByText('Renaud-Bray pickup service')).toBeVisible();
		expect(status).toBeVisible();
		expect(status).toHaveTextContent('');
	});

	it('posts only cart IDs, quantities, and normalized guest contact to the checkout API', async () => {
		const cart = createTestCart();
		cart.setQuantity('le-petit-prince', 2);
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ url: 'http://not-secure.example' }));
		vi.stubGlobal('fetch', fetchMock);
		renderCheckout(cart);

		await submitGuestDetails();

		await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
		const [url, options] = fetchMock.mock.calls[0];

		expect(url).toBe('/api/book-checkout');
		expect(options).toEqual({
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				items: [{ bookId: 'le-petit-prince', quantity: 2 }],
				name: 'Maya Chen',
				email: 'maya.chen@marianopolis.edu'
			})
		});
		await waitFor(() =>
			expect(screen.getByRole('status')).toHaveTextContent(
				'We could not open secure payment. Please try again.'
			)
		);
	});

	it('redirects only an accepted HTTPS checkout URL', async () => {
		const cart = createTestCart();
		cart.setQuantity('antigone', 1);
		const secureUrl = 'https://checkout.example.test/session/secure';
		const assign = vi.fn();
		vi.stubGlobal('location', { assign });
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ url: secureUrl })));
		renderCheckout(cart);

		await submitGuestDetails();

		await waitFor(() => expect(assign).toHaveBeenCalledWith(secureUrl));
		expect(
			screen.queryByText('We could not open secure payment. Please try again.')
		).not.toBeInTheDocument();
	});

	it('holds the review form in a loading state and issues only one request while checkout is pending', async () => {
		const cart = createTestCart();
		cart.setQuantity('antigone', 1);
		/** @type {(value: Response) => void} */
		let resolveCheckout = () => {
			throw new Error('Deferred checkout resolver was not initialized');
		};
		const pendingCheckout = new Promise((resolve) => {
			resolveCheckout = (value) => resolve(value);
		});
		const fetchMock = vi.fn().mockReturnValue(pendingCheckout);
		vi.stubGlobal('fetch', fetchMock);
		renderCheckout(cart);

		await submitGuestDetails();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
		expect(screen.getByRole('button', { name: 'Preparing secure payment' })).toBeDisabled();
		expect(screen.getByText('Preparing secure payment.')).toBeVisible();

		await fireEvent.submit(screen.getByRole('form', { name: 'Guest details' }));
		expect(fetchMock).toHaveBeenCalledOnce();

		resolveCheckout(jsonResponse({ url: 'http://not-secure.example' }));
		await waitFor(() =>
			expect(screen.getByText('We could not open secure payment. Please try again.')).toBeVisible()
		);
	});

	it.each([
		['an error response', jsonResponse({ error: 'Unavailable' }, 503)],
		['malformed JSON', new Response('not json', { status: 200 })],
		['a missing URL', jsonResponse({})],
		['a rejected network request', new Error('offline')]
	])('keeps the review retryable after %s', async (_case, result) => {
		const cart = createTestCart();
		cart.setQuantity('antigone', 1);
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockImplementation(() =>
					result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
				)
		);
		renderCheckout(cart);

		await submitGuestDetails();

		await waitFor(() =>
			expect(screen.getByText('We could not open secure payment. Please try again.')).toBeVisible()
		);
		expect(screen.getByRole('button', { name: 'Continue to secure payment' })).toBeEnabled();
	});

	it('does not imitate card checkout or claim a completed payment', () => {
		const cart = createTestCart();
		cart.setQuantity('antigone', 1);
		const { container } = renderCheckout(cart);

		expect(container).not.toHaveTextContent(
			/card number|cardholder|cvv|expiry|e-transfer|order number|payment complete|order confirmed|thank you for your order|stripe/i
		);
		expect(screen.getByRole('button', { name: 'Continue to secure payment' })).toBeVisible();
	});
});
