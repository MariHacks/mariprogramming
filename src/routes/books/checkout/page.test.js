import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOOK_CART_CONTEXT_KEY } from '$lib/books/cart-context';
import { createBookCartStore } from '$lib/books/cart-store';
import { catalogue } from '../../../test/fixtures/book-catalogue';
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
		props: { data: { launchState: 'live', catalogue, stripeCheckoutHost: null } },
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
	sessionStorage.clear();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('Book Delivery order review', () => {
	it('removes unavailable saved books while keeping a valid order review', async () => {
		const cart = createTestCart();
		cart.setQuantity('inactive-book', 1);
		cart.setQuantity('le-petit-prince', 1);

		expect(() => renderCheckout(cart)).not.toThrow();
		expect(screen.getByRole('heading', { name: 'Order review' })).toBeVisible();
		await waitFor(() =>
			expect(screen.getByText('Some unavailable books were removed from your cart.')).toBeVisible()
		);
		expect(screen.getByRole('form', { name: 'Guest details' })).toBeVisible();
	});

	it('returns to an empty review without calling checkout when every saved book is unavailable', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		const cart = createTestCart();
		cart.setQuantity('inactive-book', 1);

		expect(() => renderCheckout(cart)).not.toThrow();
		expect(screen.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
		expect(screen.getByRole('link', { name: 'Browse courses' })).toHaveAttribute('href', '/books');
		await waitFor(() =>
			expect(screen.getByText('Some unavailable books were removed from your cart.')).toBeVisible()
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});
	it('keeps an empty Book Delivery cart out of checkout and points users to courses', () => {
		const { container } = renderCheckout();

		expect(screen.getByRole('heading', { level: 1, name: 'Your cart is empty' })).toBeVisible();
		expect(screen.getByText('Choose a course to start.')).toBeVisible();
		expect(screen.getByRole('link', { name: 'Browse courses' })).toHaveAttribute('href', '/books');
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
		expect(container).not.toHaveTextContent(/Book Delivery|Review estimate/i);
	});

	it('keeps guest input and payment status together in one named task region', () => {
		const cart = createTestCart();
		cart.setQuantity('le-petit-prince', 1);
		const { container } = renderCheckout(cart);
		const guestCheckout = screen.getByRole('region', { name: 'Guest checkout' });

		expect(
			within(guestCheckout).getByRole('heading', { level: 1, name: 'Order review' })
		).toBeVisible();
		expect(within(guestCheckout).getByRole('form', { name: 'Guest details' })).toBeVisible();
		expect(
			guestCheckout.contains(container.querySelector('[aria-live="polite"][aria-atomic="true"]'))
		).toBe(true);
	});

	it('keeps every canonical amount and pickup fact in one named review region', () => {
		const cart = createTestCart();
		cart.setQuantity('le-petit-prince', 1);
		cart.setQuantity('antigone', 1);
		renderCheckout(cart);
		const orderAndPickup = screen.getByRole('region', { name: 'Order and pickup' });
		const orderSummary = within(orderAndPickup).getByRole('complementary', {
			name: 'Order summary'
		});

		expect(
			within(orderSummary)
				.getAllByRole('term')
				.map((term) => term.textContent)
		).toEqual([
			'Book subtotal',
			'Renaud-Bray pickup service',
			'Archambault pickup service',
			'Taxes',
			'Order total'
		]);
		expect(
			within(orderSummary)
				.getAllByRole('definition')
				.map((definition) => definition.textContent)
		).toEqual(['$35.90', '$5.00', '$7.00', '$5.38', '$53.28']);
		expect(within(orderAndPickup).getByRole('region', { name: 'Pickup location' })).toBeVisible();
		expect(
			within(orderAndPickup).getByText("Wayne's Front Desk", { selector: '.pickup-spot' })
		).toBeVisible();
		expect(
			within(orderAndPickup).getByText('4873 Westmount Ave, Westmount, QC H3Y 1X9')
		).toBeVisible();
	});

	it('posts one bounded random request ID, course assignments, quantities, and normalized contact', async () => {
		const cart = createTestCart();
		cart.setQuantity('le-petit-prince', 2);
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ url: 'http://not-secure.example' }));
		vi.stubGlobal('fetch', fetchMock);
		renderCheckout(cart);

		await submitGuestDetails();

		await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
		const [url, options] = fetchMock.mock.calls[0];

		expect(url).toBe('/api/book-checkout');
		expect(options.method).toBe('POST');
		expect(options.headers).toEqual({ 'content-type': 'application/json' });
		const posted = JSON.parse(options.body);
		expect(posted).toEqual({
			requestId: expect.stringMatching(/^ckr1_[A-Za-z0-9_-]{43}$/u),
			courses: [
				{
					teacherSlug: 'mme-tremblay',
					courseId: 'french-101',
					items: [{ bookId: 'le-petit-prince', quantity: 2 }]
				}
			],
			name: 'Maya Chen',
			email: 'maya.chen@marianopolis.edu'
		});
		expect(options).toMatchObject({
			method: 'POST',
			headers: { 'content-type': 'application/json' }
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
		const secureUrl = 'https://checkout.stripe.com/c/pay_secure';
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

	it.each([
		['a javascript URL', 'javascript:alert("unsafe checkout")'],
		['a credential-bearing HTTPS URL', 'https://pickup:secret@checkout.stripe.com/session'],
		['a Stripe suffix trick', 'https://checkout.stripe.com.attacker.example/session'],
		['an unapproved HTTPS host', 'https://checkout.example.test/session']
	])('refuses %s without navigating away from the order review', async (_case, unsafeUrl) => {
		const cart = createTestCart();
		cart.setQuantity('antigone', 1);
		const assign = vi.fn();
		vi.stubGlobal('location', { assign });
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ url: unsafeUrl })));
		renderCheckout(cart);

		await submitGuestDetails();

		await waitFor(() =>
			expect(screen.getByRole('status')).toHaveTextContent(
				'We could not open secure payment. Please try again.'
			)
		);
		expect(assign).not.toHaveBeenCalled();
		expect(screen.getByRole('button', { name: 'Continue to secure payment' })).toBeEnabled();
	});

	it('reuses the exact browser request ID after a retryable 503 without storing contact data', async () => {
		const cart = createTestCart();
		cart.setQuantity('antigone', 1);
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'Unavailable' }, 503));
		vi.stubGlobal('fetch', fetchMock);
		renderCheckout(cart);

		await submitGuestDetails();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
		await fireEvent.submit(screen.getByRole('form', { name: 'Guest details' }));
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		const first = JSON.parse(fetchMock.mock.calls[0][1].body);
		const retry = JSON.parse(fetchMock.mock.calls[1][1].body);
		expect(retry.requestId).toBe(first.requestId);
		const stored = sessionStorage.getItem('mpc.book-checkout-request.v1');
		expect(stored).toContain(first.requestId);
		expect(stored).not.toContain('maya');
		expect(stored).not.toContain('antigone');
	});

	it('reuses its in-memory request ID when session storage is blocked', async () => {
		const cart = createTestCart();
		cart.setQuantity('antigone', 1);
		let nextByte = 1;
		const getRandomValues = vi.fn((target) => {
			target.fill(nextByte++);
			return target;
		});
		vi.stubGlobal('crypto', { getRandomValues });
		vi.stubGlobal('sessionStorage', {
			getItem: vi.fn(() => {
				throw new Error('storage blocked');
			}),
			setItem: vi.fn(() => {
				throw new Error('storage blocked');
			}),
			clear: vi.fn()
		});
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'Unavailable' }, 503));
		vi.stubGlobal('fetch', fetchMock);
		renderCheckout(cart);

		await submitGuestDetails();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
		await fireEvent.submit(screen.getByRole('form', { name: 'Guest details' }));
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		const first = JSON.parse(fetchMock.mock.calls[0][1].body);
		const retry = JSON.parse(fetchMock.mock.calls[1][1].body);
		expect(retry.requestId).toBe(first.requestId);
		expect(getRandomValues).toHaveBeenCalledOnce();
	});

	it('does not reuse one request ID after the submitted checkout details change', async () => {
		const cart = createTestCart();
		cart.setQuantity('antigone', 1);
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'Unavailable' }, 503));
		vi.stubGlobal('fetch', fetchMock);
		renderCheckout(cart);
		await submitGuestDetails();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
		await fireEvent.input(screen.getByRole('textbox', { name: 'Name for pickup' }), {
			target: { value: 'Different Name' }
		});
		await fireEvent.submit(screen.getByRole('form', { name: 'Guest details' }));

		expect(fetchMock).toHaveBeenCalledOnce();
		expect(screen.getByRole('status')).toHaveTextContent(
			'Restore the original checkout details before retrying.'
		);
	});

	it('accepts only the configured exact custom Stripe checkout host', async () => {
		const cart = createTestCart();
		cart.setQuantity('antigone', 1);
		const assign = vi.fn();
		vi.stubGlobal('location', { assign });
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(jsonResponse({ url: 'https://pay.club.example/session' }))
		);
		render(CheckoutPage, {
			props: {
				data: { launchState: 'live', catalogue, stripeCheckoutHost: 'pay.club.example' }
			},
			context: new Map([[BOOK_CART_CONTEXT_KEY, cart]])
		});

		await submitGuestDetails();
		await waitFor(() => expect(assign).toHaveBeenCalledWith('https://pay.club.example/session'));
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

	it('does not imitate card inputs or claim a completed payment before the Stripe handoff', () => {
		const cart = createTestCart();
		cart.setQuantity('antigone', 1);
		const { container } = renderCheckout(cart);

		expect(container).not.toHaveTextContent(
			/card number|cardholder|cvv|expiry|e-transfer|order number|payment complete|order confirmed|thank you for your order/i
		);
		expect(screen.getByRole('button', { name: 'Continue to secure payment' })).toBeVisible();
	});
});
