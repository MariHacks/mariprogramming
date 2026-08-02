import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOOK_CART_CONTEXT_KEY } from '$lib/books/cart-context';
import { createBookCartStore } from '$lib/books/cart-store';
import { clubContent } from '$lib/content/club';
import OrderConfirmationPage from './+page.svelte';

/**
 * @typedef {{
 *   status: 'paid',
 *   orderReference: string,
 *   receiptEmail: string | null,
 *   lineItems: { title: string, quantity: number }[]
 * }} PaidConfirmation
 */

/**
 * @typedef {{
 *   status: 'recovery',
 *   reason: 'missing' | 'invalid' | 'unpaid' | 'expired' | 'unavailable',
 *   returnPath: string
 * }} RecoveryConfirmation
 */

/** @type {string} */
const RECEIPT_EMAIL = 'maya.chen@marianopolis.edu';

/** @type {PaidConfirmation} */
const PAID_CONFIRMATION = {
	status: 'paid',
	orderReference: 'cs_test_order_confirmation_123',
	receiptEmail: RECEIPT_EMAIL,
	lineItems: [
		{ title: 'Le Petit Prince', quantity: 2 },
		{ title: 'Renaud-Bray pickup service', quantity: 1 }
	]
};

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
	return createBookCartStore('order-confirmation-test-cart', createMemoryStorage());
}

/** @param {ReturnType<typeof createTestCart>} cart */
function currentCart(cart) {
	/** @type {{ items: { bookId: string, quantity: number }[] }} */
	let current = { items: [] };
	const unsubscribe = cart.subscribe((value) => {
		current = value;
	});
	unsubscribe();
	return current;
}

/**
 * @param {{ confirmation: PaidConfirmation | RecoveryConfirmation }} data
 * @param {ReturnType<typeof createTestCart>} [cart]
 */
function renderConfirmation(data, cart = createTestCart()) {
	const view = render(OrderConfirmationPage, {
		props: { data },
		context: new Map([[BOOK_CART_CONTEXT_KEY, cart]])
	});

	return { ...view, cart };
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe('Book Delivery order confirmation', () => {
	it('shows one verified paid confirmation with receipt, line-item, and pickup context', async () => {
		const cart = createTestCart();
		cart.setQuantity('le-petit-prince', 2);
		const { container } = renderConfirmation({ confirmation: PAID_CONFIRMATION }, cart);

		await waitFor(() => expect(currentCart(cart)).toEqual({ items: [] }));

		expect(screen.getAllByRole('heading', { level: 1, name: 'Payment confirmed' })).toHaveLength(1);
		expect(screen.getByRole('status')).toHaveTextContent('Payment confirmed');
		expect(screen.getByText(PAID_CONFIRMATION.orderReference)).toBeVisible();
		expect(screen.getByText(RECEIPT_EMAIL)).toBeVisible();
		expect(screen.getByText('Le Petit Prince')).toBeVisible();
		expect(screen.getByText('Quantity 2')).toBeVisible();
		expect(screen.getByRole('region', { name: 'Pickup location' })).toBeVisible();
		expect(document.title).toBe(`Payment confirmed | ${clubContent.name}`);
		expect(container).not.toHaveTextContent(
			/card number|cvv|expiry|e-transfer|payment intent|inventory|available now/i
		);
	});

	it('clears the Book Delivery cart exactly once after paid data reaches the client', async () => {
		const cart = createTestCart();
		cart.setQuantity('antigone', 1);
		const clear = vi.spyOn(cart, 'clear');
		const view = renderConfirmation({ confirmation: PAID_CONFIRMATION }, cart);

		await waitFor(() => expect(clear).toHaveBeenCalledTimes(1));
		await view.rerender({ data: { confirmation: PAID_CONFIRMATION } });

		expect(clear).toHaveBeenCalledTimes(1);
		expect(currentCart(cart)).toEqual({ items: [] });
	});

	it('keeps recovery calm and leaves the local cart untouched when payment is not confirmed', async () => {
		const cart = createTestCart();
		cart.setQuantity('antigone', 1);
		const { container } = renderConfirmation(
			{
				confirmation: {
					status: 'recovery',
					reason: 'unpaid',
					returnPath: '/books/cart'
				}
			},
			cart
		);

		await Promise.resolve();

		expect(
			screen.getAllByRole('heading', { level: 1, name: 'Payment not confirmed' })
		).toHaveLength(1);
		expect(screen.getByRole('status')).toHaveTextContent('Payment not confirmed');
		expect(screen.getByRole('link', { name: 'Return to your cart' })).toHaveAttribute(
			'href',
			'/books/cart'
		);
		expect(currentCart(cart)).toEqual({ items: [{ bookId: 'antigone', quantity: 1 }] });
		expect(screen.queryByRole('region', { name: 'Pickup location' })).not.toBeInTheDocument();
		expect(container).not.toHaveTextContent(/payment confirmed|receipt email|wayne/i);
		expect(document.title).toBe(`Payment confirmation | ${clubContent.name}`);
	});
});
