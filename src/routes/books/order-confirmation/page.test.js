import { cleanup, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compile } from 'svelte/compiler';
import pageSource from './+page.svelte?raw';
import { BOOK_CART_CONTEXT_KEY } from '$lib/books/cart-context';
import { createBookCartStore } from '$lib/books/cart-store';
import {
	CHECKOUT_REQUEST_STORAGE_KEY,
	getOrCreateCheckoutRequestId
} from '$lib/books/checkout-request';
import { clubContent } from '$lib/content/club';
import OrderConfirmationPage from './+page.svelte';

const ORDER_REFERENCE = 'MPC-ABCDEFGHJK23';
const REQUEST_ID = `ckr1_${Buffer.alloc(32, 1).toString('base64url')}`;
const COURSE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BOOK_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PICKUP_ADDRESS = '4873 Westmount Ave, Westmount, QC H3Y 1X9';

const PAID_CONFIRMATION = Object.freeze({
	state: 'paid',
	orderReference: ORDER_REFERENCE,
	receiptEmail: 'm***@marianopolis.edu',
	currency: 'cad',
	fulfillmentStatus: 'unstarted',
	bookSubtotalCents: 4000,
	serviceFeeCents: 500,
	taxCents: 674,
	totalCents: 5174,
	refundedAmountCents: 0,
	books: [
		{
			courseId: COURSE_ID,
			bookId: BOOK_ID,
			title: 'Algorithms',
			isbn: '9780000000000',
			bookstoreName: 'Campus Books',
			courseCode: 'CSC 205',
			courseTitle: 'Data Structures',
			quantity: 2,
			unitAmountCents: 2000,
			lineAmountCents: 4000
		}
	],
	fees: [
		{
			bookstoreId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
			label: 'Campus Books pickup service',
			amountCents: 500
		}
	],
	browserCleanup: {
		requestId: REQUEST_ID,
		cartSelections: [{ courseId: COURSE_ID, bookId: BOOK_ID, quantity: 2 }]
	}
});

/** @param {Record<string, string>} [initialEntries] */
function createMemoryStorage(initialEntries = {}) {
	const entries = new Map(Object.entries(initialEntries));
	return {
		getItem: vi.fn((key) => entries.get(key) ?? null),
		setItem: vi.fn((key, value) => entries.set(key, String(value))),
		removeItem: vi.fn((/** @type {string} */ key) => entries.delete(key)),
		valueAt: (/** @type {string} */ key) => entries.get(key) ?? null
	};
}

/** @param {{ courseId?: string, bookId: string, quantity: number }[]} [initialItems] */
function createTestCart(initialItems = []) {
	const storage = createMemoryStorage({
		'order-confirmation-test-cart': JSON.stringify({ items: initialItems })
	});
	const cart = createBookCartStore('order-confirmation-test-cart', storage);
	cart.hydrate();
	return { cart, storage };
}

/** @param {ReturnType<typeof createBookCartStore>} cart */
function currentCart(cart) {
	/** @type {{ items: { courseId?: string, bookId: string, quantity: number }[] }} */
	let current = { items: [] };
	const unsubscribe = cart.subscribe(
		(/** @type {{ items: { courseId?: string, bookId: string, quantity: number }[] }} */ value) => {
			current = value;
		}
	);
	unsubscribe();
	return current;
}

/** @param {any} data @param {ReturnType<typeof createBookCartStore>} [cart] */
function renderConfirmation(data, cart = createTestCart().cart) {
	return {
		...render(OrderConfirmationPage, {
			props: { data },
			context: new Map([[BOOK_CART_CONTEXT_KEY, cart]])
		}),
		cart
	};
}

/** @param {string} state @param {Record<string, any>} [overrides] */
function terminalConfirmation(state, overrides = {}) {
	return {
		...PAID_CONFIRMATION,
		state,
		browserCleanup: { requestId: REQUEST_ID, cartSelections: [] },
		...overrides
	};
}

beforeEach(() => {
	sessionStorage.clear();
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe('Book Delivery order confirmation', () => {
	it('keeps the editorial two-column layout responsive with restrained reduced motion', () => {
		const { css } = compile(pageSource, { generate: 'client', cssHash: () => 'scope' });
		const compiledCss = css?.code ?? '';

		expect(compiledCss).toMatch(
			/@media \(min-width: 64rem\)[\s\S]*grid-template-columns:\s*minmax\(0, 1\.15fr\) minmax\(25rem, 0\.85fr\)/
		);
		expect(compiledCss).toMatch(
			/\.confirmed-layout[^{}]*\.confirmation-intro[^{}]*\{[^{}]*animation:\s*confirmation-arrive/
		);
		expect(compiledCss).not.toMatch(/\.order-lines[^{}]*\{[^{}]*animation:/);
		const reducedMotionCss = compiledCss.split('@media (prefers-reduced-motion: reduce)')[1] ?? '';
		expect(reducedMotionCss).toContain('.confirmation-intro');
		expect(reducedMotionCss).toContain('animation-duration: var(--motion-press) !important');
		expect(reducedMotionCss).toContain('transform: none !important');
	});

	it('renders only persisted receipt facts and the paid pickup location', () => {
		const { container } = renderConfirmation({ confirmation: PAID_CONFIRMATION });

		expect(screen.getByRole('heading', { level: 1, name: 'Payment confirmed' })).toBeVisible();
		const receipt = screen.getByRole('region', { name: 'Order receipt' });
		expect(within(receipt).getByText(ORDER_REFERENCE)).toBeVisible();
		expect(within(receipt).getByText('m***@marianopolis.edu')).toBeVisible();
		expect(within(receipt).getByText('Purchasing has not started')).toBeVisible();
		expect(within(receipt).getByText('Algorithms')).toBeVisible();
		expect(within(receipt).getByText('CSC 205')).toBeVisible();
		expect(within(receipt).getByText('Data Structures')).toBeVisible();
		expect(within(receipt).getByText('Campus Books')).toBeVisible();
		expect(within(receipt).getByText('ISBN 9780000000000')).toBeVisible();
		expect(within(receipt).getByText('Quantity 2')).toBeVisible();
		expect(within(receipt).getAllByText('$40.00').length).toBeGreaterThan(0);
		expect(within(receipt).getByText('Campus Books pickup service')).toBeVisible();
		expect(within(receipt).getByText('$5.00')).toBeVisible();
		expect(within(receipt).getByText('$6.74')).toBeVisible();
		expect(within(receipt).getByText('$51.74')).toBeVisible();
		expect(within(receipt).getByText(/club purchases books manually/i)).toBeVisible();

		const pickup = screen.getByRole('region', { name: 'Pickup location' });
		expect(
			within(pickup).getByText("Wayne's Front Desk", { selector: '.pickup-spot' })
		).toBeVisible();
		expect(within(pickup).getByText('Marianopolis College')).toBeVisible();
		expect(within(pickup).getByText(PICKUP_ADDRESS)).toBeVisible();
		expect(within(pickup).getByRole('link', { name: 'Open in Maps in a new tab' })).toHaveAttribute(
			'rel',
			'noreferrer'
		);
		expect(document.title).toBe(`Payment confirmed | ${clubContent.name}`);
		expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
			'content',
			'noindex, nofollow'
		);
		expect(document.querySelector('meta[name="referrer"]')).toHaveAttribute(
			'content',
			'no-referrer'
		);
		expect(container).not.toHaveTextContent(
			/maya\.chen|session_id|cs_test|payment intent|confirmation capability|card number|cvv/i
		);
	});

	it('selectively consumes the paid order and retires only its matching checkout request', async () => {
		const { cart } = createTestCart([
			{ courseId: COURSE_ID, bookId: BOOK_ID, quantity: 3 },
			{ courseId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', bookId: 'other-book', quantity: 1 }
		]);
		const consume = vi.spyOn(cart, 'consumeConfirmedOrder');
		sessionStorage.setItem(CHECKOUT_REQUEST_STORAGE_KEY, JSON.stringify({ v: 1, id: REQUEST_ID }));
		const view = renderConfirmation({ confirmation: PAID_CONFIRMATION }, cart);

		await waitFor(() => expect(consume).toHaveBeenCalledOnce());
		expect(consume).toHaveBeenCalledWith(ORDER_REFERENCE, [
			{ courseId: COURSE_ID, bookId: BOOK_ID, quantity: 2 }
		]);
		expect(currentCart(cart)).toEqual({
			items: [
				{ courseId: COURSE_ID, bookId: BOOK_ID, quantity: 1 },
				{
					courseId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
					bookId: 'other-book',
					quantity: 1
				}
			]
		});
		expect(sessionStorage.getItem(CHECKOUT_REQUEST_STORAGE_KEY)).toBeNull();

		await view.rerender({ data: { launchState: 'live', confirmation: PAID_CONFIRMATION } });
		expect(consume).toHaveBeenCalledOnce();
	});

	it('contains blocked session storage cleanup and retries once after rerender', async () => {
		const availableStorage = globalThis.sessionStorage;
		availableStorage.setItem(
			CHECKOUT_REQUEST_STORAGE_KEY,
			JSON.stringify({ v: 1, id: REQUEST_ID })
		);
		const storageGetter = vi
			.spyOn(globalThis, 'sessionStorage', 'get')
			.mockImplementationOnce(() => {
				throw new Error('Session storage is blocked');
			})
			.mockImplementation(() => availableStorage);
		const unhandledRejection = vi.fn();
		const rejectionListener = (/** @type {PromiseRejectionEvent} */ event) => {
			event.preventDefault();
			unhandledRejection(event.reason);
		};
		window.addEventListener('unhandledrejection', rejectionListener);

		try {
			const { cart } = createTestCart([{ courseId: COURSE_ID, bookId: BOOK_ID, quantity: 2 }]);
			const consume = vi.spyOn(cart, 'consumeConfirmedOrder');
			const view = renderConfirmation({ confirmation: PAID_CONFIRMATION }, cart);

			await waitFor(() => expect(storageGetter).toHaveBeenCalledOnce());
			await Promise.resolve();
			expect(unhandledRejection).not.toHaveBeenCalled();
			expect(availableStorage.getItem(CHECKOUT_REQUEST_STORAGE_KEY)).toBe(
				JSON.stringify({ v: 1, id: REQUEST_ID })
			);
			expect(consume).toHaveBeenCalledOnce();

			await view.rerender({
				data: { launchState: 'live', confirmation: PAID_CONFIRMATION }
			});
			await waitFor(() =>
				expect(availableStorage.getItem(CHECKOUT_REQUEST_STORAGE_KEY)).toBeNull()
			);
			expect(consume).toHaveBeenCalledTimes(2);

			await view.rerender({
				data: { launchState: 'live', confirmation: PAID_CONFIRMATION }
			});
			await Promise.resolve();
			expect(consume).toHaveBeenCalledTimes(2);
			expect(unhandledRejection).not.toHaveBeenCalled();
		} finally {
			window.removeEventListener('unhandledrejection', rejectionListener);
		}
	});

	it('preserves a newer checkout request while cleaning the confirmed order', async () => {
		const nextRequestId = getOrCreateCheckoutRequestId({
			storage: sessionStorage,
			crypto: /** @type {Pick<Crypto, 'getRandomValues'>} */ ({
				getRandomValues(bytes) {
					/** @type {Uint8Array} */ (/** @type {unknown} */ (bytes)).fill(2);
					return bytes;
				}
			})
		});
		const { cart } = createTestCart([{ courseId: COURSE_ID, bookId: BOOK_ID, quantity: 2 }]);
		renderConfirmation({ confirmation: PAID_CONFIRMATION }, cart);

		await waitFor(() => expect(currentCart(cart)).toEqual({ items: [] }));
		expect(sessionStorage.getItem(CHECKOUT_REQUEST_STORAGE_KEY)).toBe(
			JSON.stringify({ v: 1, id: nextRequestId })
		);
	});

	it('keeps the matching request available when selective cart cleanup cannot finish', async () => {
		const { cart } = createTestCart([{ courseId: COURSE_ID, bookId: BOOK_ID, quantity: 2 }]);
		vi.spyOn(cart, 'consumeConfirmedOrder').mockResolvedValue(false);
		sessionStorage.setItem(CHECKOUT_REQUEST_STORAGE_KEY, JSON.stringify({ v: 1, id: REQUEST_ID }));
		renderConfirmation({ confirmation: PAID_CONFIRMATION }, cart);

		await waitFor(() => expect(cart.consumeConfirmedOrder).toHaveBeenCalledOnce());
		expect(sessionStorage.getItem(CHECKOUT_REQUEST_STORAGE_KEY)).toBe(
			JSON.stringify({ v: 1, id: REQUEST_ID })
		);
		expect(currentCart(cart).items).toHaveLength(1);
	});

	it('shows processing from persisted webhook state without changing browser checkout state', async () => {
		const { cart } = createTestCart([{ courseId: COURSE_ID, bookId: BOOK_ID, quantity: 2 }]);
		const consume = vi.spyOn(cart, 'consumeConfirmedOrder');
		sessionStorage.setItem(CHECKOUT_REQUEST_STORAGE_KEY, JSON.stringify({ v: 1, id: REQUEST_ID }));
		renderConfirmation(
			{
				confirmation: { ...PAID_CONFIRMATION, state: 'processing', browserCleanup: null }
			},
			cart
		);

		await Promise.resolve();
		expect(screen.getByRole('heading', { level: 1, name: 'Payment is processing' })).toBeVisible();
		expect(
			screen.getByText(/Stripe has not confirmed payment yet\. Refresh this page in a moment\./i)
		).toBeVisible();
		expect(consume).not.toHaveBeenCalled();
		expect(currentCart(cart).items).toHaveLength(1);
		expect(sessionStorage.getItem(CHECKOUT_REQUEST_STORAGE_KEY)).not.toBeNull();
		expect(screen.queryByRole('region', { name: 'Pickup location' })).not.toBeInTheDocument();
	});

	it.each([
		[
			'partially_refunded',
			'Part of this payment was refunded',
			1000,
			'Refunded to date',
			'$10.00',
			true
		],
		['refunded', 'This payment was refunded', 5174, 'Refunded to date', '$51.74', false],
		['expired', 'Payment window expired', 0, null, null, false],
		['failed', 'Payment was not confirmed', 0, null, null, false],
		['cancelled', 'Checkout cancelled', 0, null, null, false]
	])(
		'renders a factual %s terminal state, retires its request, and does not imply pickup',
		async (state, heading, refundedAmountCents, refundLabel, refundAmount, confirmedPurchase) => {
			const { cart } = createTestCart([{ courseId: COURSE_ID, bookId: BOOK_ID, quantity: 2 }]);
			sessionStorage.setItem(
				CHECKOUT_REQUEST_STORAGE_KEY,
				JSON.stringify({ v: 1, id: REQUEST_ID })
			);
			renderConfirmation(
				{
					confirmation: terminalConfirmation(state, {
						refundedAmountCents,
						browserCleanup: {
							requestId: REQUEST_ID,
							cartSelections: confirmedPurchase
								? [{ courseId: COURSE_ID, bookId: BOOK_ID, quantity: 2 }]
								: []
						}
					})
				},
				cart
			);

			await waitFor(() => expect(sessionStorage.getItem(CHECKOUT_REQUEST_STORAGE_KEY)).toBeNull());
			expect(screen.getByRole('heading', { level: 1, name: heading })).toBeVisible();
			expect(currentCart(cart).items).toHaveLength(confirmedPurchase ? 0 : 1);
			expect(screen.queryByRole('region', { name: 'Pickup location' })).not.toBeInTheDocument();
			if (refundLabel && refundAmount) {
				const ledger = screen.getByRole('region', { name: 'Payment summary' });
				const refundRow = within(ledger).getByText(refundLabel).closest('div');
				expect(refundRow).not.toBeNull();
				expect(
					within(/** @type {HTMLElement} */ (refundRow)).getByText(refundAmount)
				).toBeVisible();
			}
		}
	);

	it('uses one generic recovery page without receipt, cart, or pickup disclosure', async () => {
		const { cart } = createTestCart([{ courseId: COURSE_ID, bookId: BOOK_ID, quantity: 2 }]);
		const consume = vi.spyOn(cart, 'consumeConfirmedOrder');
		renderConfirmation(
			{
				confirmation: { status: 'unavailable', returnPath: '/books/cart' }
			},
			cart
		);

		await Promise.resolve();
		expect(
			screen.getByRole('heading', { level: 1, name: "We couldn't open this order" })
		).toBeVisible();
		expect(screen.getByText(/same browser that started checkout/i)).toBeVisible();
		expect(screen.getByRole('link', { name: 'Return to your cart' })).toHaveAttribute(
			'href',
			'/books/cart'
		);
		expect(screen.getByRole('link', { name: 'Browse courses' })).toHaveAttribute('href', '/books');
		expect(consume).not.toHaveBeenCalled();
		expect(currentCart(cart).items).toHaveLength(1);
		expect(screen.queryByRole('region', { name: 'Order receipt' })).not.toBeInTheDocument();
		expect(screen.queryByRole('region', { name: 'Pickup location' })).not.toBeInTheDocument();
		expect(document.body).not.toHaveTextContent(/MPC-|receipt email|Wayne|Algorithms/i);
		expect(document.title).toBe(`Order unavailable | ${clubContent.name}`);
	});
});
