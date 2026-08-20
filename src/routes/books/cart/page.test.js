import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { BOOK_CART_CONTEXT_KEY } from '$lib/books/cart-context';
import { createBookCartStore } from '$lib/books/cart-store';
import { catalogue } from '../../../test/fixtures/book-catalogue';
import { clubContent } from '$lib/content/club';
import CartPage from './+page.svelte';

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
	return createBookCartStore('cart-page-test-cart', createMemoryStorage());
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

/** @param {ReturnType<typeof createTestCart>} [cart] */
function renderCart(cart = createTestCart()) {
	const view = render(CartPage, {
		props: { data: { launchState: 'live', catalogue } },
		context: new Map([[BOOK_CART_CONTEXT_KEY, cart]])
	});

	return { ...view, cart };
}

afterEach(cleanup);

describe('Book Delivery cart page', () => {
	it('removes unavailable saved books while keeping valid cart lines', async () => {
		const cart = createTestCart();
		cart.setQuantity('inactive-book', 1);
		cart.setQuantity('le-petit-prince', 2);

		expect(() => renderCart(cart)).not.toThrow();
		expect(currentCart(cart)).toEqual({
			items: [{ bookId: 'le-petit-prince', quantity: 2 }]
		});
		await waitFor(() =>
			expect(screen.getByText('Some unavailable books were removed from your cart.')).toBeVisible()
		);
		expect(screen.getByRole('region', { name: 'Renaud-Bray' })).toBeVisible();
	});

	it('recovers to the empty cart action when every saved book is unavailable', async () => {
		const cart = createTestCart();
		cart.setQuantity('inactive-book', 1);

		expect(() => renderCart(cart)).not.toThrow();
		expect(currentCart(cart)).toEqual({ items: [] });
		expect(screen.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
		expect(screen.getByRole('link', { name: 'Browse course lists' })).toHaveAttribute(
			'href',
			'/books'
		);
		await waitFor(() =>
			expect(screen.getByText('Some unavailable books were removed from your cart.')).toBeVisible()
		);
	});
	it('routes an empty cart back to course lists without showing checkout information', () => {
		const { container } = renderCart();

		expect(screen.getByRole('heading', { level: 1, name: 'Your cart is empty' })).toBeVisible();
		expect(screen.getByText('Choose a course, then select the books you need.')).toBeVisible();
		expect(screen.getByRole('link', { name: 'Browse course lists' })).toHaveAttribute(
			'href',
			'/books'
		);
		expect(screen.getAllByRole('link')).toHaveLength(1);
		expect(screen.queryByRole('complementary', { name: 'Order summary' })).not.toBeInTheDocument();
		expect(screen.queryByRole('region')).not.toBeInTheDocument();
		expect(
			screen.queryByRole('link', { name: 'Continue to order review' })
		).not.toBeInTheDocument();
		expect(container).not.toHaveTextContent(/tax|service fee|pickup|map|wayne|payment|e-transfer/i);
		expect(document.title).toBe(`Your cart | ${clubContent.name}`);
	});

	it('groups canonical cart lines by bookstore and shows one matching fee per group', () => {
		const cart = createTestCart();
		cart.setQuantity('le-petit-prince', 2);
		cart.setQuantity('antigone', 1);
		const { container } = renderCart(cart);

		const renaudBray = screen.getByRole('region', { name: 'Renaud-Bray' });
		const archambault = screen.getByRole('region', { name: 'Archambault' });
		const bookstoreOrder = screen
			.getAllByRole('region', { name: /Renaud-Bray|Archambault/ })
			.map((group) => within(group).getByRole('heading', { level: 2 }).textContent);

		expect(screen.getByRole('heading', { level: 1, name: 'Your cart' })).toBeVisible();
		expect(
			screen.getByText('Your order includes one pickup service fee for each bookstore.')
		).toBeVisible();
		expect(container).not.toHaveTextContent(
			/Book Delivery cart|Your book delivery cart|Books by bookstore/i
		);
		expect(bookstoreOrder).toEqual(['Renaud-Bray', 'Archambault']);
		expect(within(renaudBray).getByRole('list', { name: 'Renaud-Bray books' })).toBeVisible();
		expect(within(archambault).getByRole('list', { name: 'Archambault books' })).toBeVisible();
		expect(within(renaudBray).getAllByText('Le Petit Prince')[0]).toBeVisible();
		expect(within(renaudBray).getAllByText('Renaud-Bray pickup service')).toHaveLength(1);
		expect(within(renaudBray).getAllByText('$5.00')).toHaveLength(1);
		expect(within(archambault).getAllByText('Antigone')[0]).toBeVisible();
		expect(within(archambault).getAllByText('Archambault pickup service')).toHaveLength(1);
		expect(within(archambault).getAllByText('$7.00')).toHaveLength(1);
		expect(screen.getByRole('complementary', { name: 'Order summary' })).toBeVisible();
		expect(screen.getByRole('link', { name: 'Continue to order review' })).toHaveAttribute(
			'href',
			'/books/checkout'
		);
		expect(screen.queryByRole('button', { name: /pay|stripe/i })).not.toBeInTheDocument();
	});

	it('keeps a live status region exposed before and throughout cart changes', async () => {
		const cart = createTestCart();
		cart.setQuantity('le-petit-prince', 2);
		cart.setQuantity('antigone', 1);
		const { container } = renderCart(cart);
		const status = container.querySelector('[aria-live="polite"][aria-atomic="true"]');

		expect(status).toBeVisible();
		expect(status).toHaveTextContent('');

		await fireEvent.click(
			screen.getByRole('button', { name: 'Increase quantity for Le Petit Prince' })
		);

		expect(status).toHaveTextContent('Quantity for Le Petit Prince updated to 3.');

		await fireEvent.click(screen.getByRole('button', { name: 'Remove Antigone' }));

		expect(status).toHaveTextContent('Antigone removed from your cart.');
	});

	it('updates one line, then removes a one-book bookstore without changing another group', async () => {
		const cart = createTestCart();
		cart.setQuantity('le-petit-prince', 2);
		cart.setQuantity('antigone', 1);
		renderCart(cart);

		await fireEvent.click(
			screen.getByRole('button', { name: 'Increase quantity for Le Petit Prince' })
		);

		expect(currentCart(cart)).toEqual({
			items: [
				{ bookId: 'le-petit-prince', quantity: 3 },
				{ bookId: 'antigone', quantity: 1 }
			]
		});
		expect(screen.getByText('Quantity for Le Petit Prince updated to 3.')).toBeVisible();

		await fireEvent.click(screen.getByRole('button', { name: 'Remove Antigone' }));

		expect(currentCart(cart)).toEqual({
			items: [{ bookId: 'le-petit-prince', quantity: 3 }]
		});
		expect(screen.queryByRole('region', { name: 'Archambault' })).not.toBeInTheDocument();
		expect(screen.queryByText('Archambault pickup service')).not.toBeInTheDocument();
		expect(screen.getByRole('region', { name: 'Renaud-Bray' })).toBeVisible();
		expect(screen.getByText('Antigone removed from your cart.')).toBeVisible();
	});

	it('edits one course assignment when the same book ID appears in two courses', async () => {
		const cart = createTestCart();
		cart.setQuantity('shared-book', 1, 'course-a');
		cart.setQuantity('shared-book', 2, 'course-b');
		const sharedCatalogue = {
			taxRateBps: 0,
			bookstores: [{ id: 'store', name: 'Store', serviceFeeCents: 500 }],
			books: [
				{
					id: 'shared-book',
					courseId: 'course-a',
					teacherSlug: 'teacher-a',
					title: 'Course A edition',
					author: 'Writer A',
					isbn: null,
					priceCents: 1000,
					bookstoreId: 'store',
					storefrontUrl: null,
					coverUrl: null
				},
				{
					id: 'shared-book',
					courseId: 'course-b',
					teacherSlug: 'teacher-b',
					title: 'Course B edition',
					author: 'Writer B',
					isbn: null,
					priceCents: 2000,
					bookstoreId: 'store',
					storefrontUrl: null,
					coverUrl: null
				}
			]
		};
		render(CartPage, {
			props: { data: { launchState: 'live', catalogue: sharedCatalogue } },
			context: new Map([[BOOK_CART_CONTEXT_KEY, cart]])
		});

		expect(screen.getByRole('heading', { level: 3, name: 'Course A edition' })).toBeVisible();
		expect(screen.getByRole('heading', { level: 3, name: 'Course B edition' })).toBeVisible();
		await fireEvent.click(
			screen.getByRole('button', { name: 'Increase quantity for Course A edition' })
		);
		expect(currentCart(cart)).toEqual({
			items: [
				{ courseId: 'course-a', bookId: 'shared-book', quantity: 2 },
				{ courseId: 'course-b', bookId: 'shared-book', quantity: 2 }
			]
		});
	});
});
