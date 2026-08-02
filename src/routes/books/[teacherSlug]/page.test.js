import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { BOOK_CART_CONTEXT_KEY } from '$lib/books/cart-context';
import { createBookCartStore } from '$lib/books/cart-store';
import { clubContent } from '$lib/content/club';
import TeacherBooksPage from './+page.svelte';
import { load } from './+page.js';

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
	return createBookCartStore('teacher-page-test-cart', createMemoryStorage());
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
 * @param {ReturnType<typeof createTestCart>} [cart]
 */
function renderFrenchList(cart = createTestCart()) {
	const data = load({ params: { teacherSlug: 'mme-tremblay' } });
	const view = render(TeacherBooksPage, {
		props: { data },
		context: new Map([[BOOK_CART_CONTEXT_KEY, cart]])
	});

	return { ...view, cart, data };
}

afterEach(cleanup);

describe('teacher book list loader', () => {
	it('returns a serializable teacher record grouped by course and bookstore', () => {
		const data = load({ params: { teacherSlug: 'mme-tremblay' } });

		expect(Object.keys(data)).toEqual(['teacher', 'courses']);
		expect(data.teacher).toMatchObject({ slug: 'mme-tremblay', name: 'Mme Tremblay' });
		expect(data.courses).toEqual([
			expect.objectContaining({
				code: 'FRE-101',
				title: 'French 101',
				books: [
					expect.objectContaining({
						title: 'Le Petit Prince',
						bookstoreName: 'Renaud-Bray'
					}),
					expect.objectContaining({ title: 'Bescherelle', bookstoreName: 'Renaud-Bray' })
				]
			}),
			expect.objectContaining({
				code: 'FRE-102',
				title: 'French 102',
				books: [expect.objectContaining({ title: 'Antigone', bookstoreName: 'Archambault' })]
			})
		]);
		expect(JSON.parse(JSON.stringify(data))).toEqual(data);
	});

	it('throws a 404 response for an unknown teacher slug', () => {
		expect.assertions(2);

		try {
			load({ params: { teacherSlug: 'unknown-teacher' } });
		} catch (exception) {
			const httpError = /** @type {{ status: number, body: { message: string } }} */ (exception);
			expect(httpError).toMatchObject({ status: 404 });
			expect(httpError.body).toMatchObject({ message: 'Teacher not found' });
		}
	});
});

describe('teacher book list page', () => {
	it('starts with every title selected and accurate teacher-specific metadata', () => {
		const { container } = renderFrenchList();

		expect(screen.getByRole('heading', { level: 1, name: 'Books for Mme Tremblay' })).toBeVisible();
		expect(container.querySelectorAll('h1')).toHaveLength(1);
		expect(screen.getByRole('heading', { level: 2, name: /FRE-101 French 101/ })).toBeVisible();
		expect(screen.getByRole('heading', { level: 2, name: /FRE-102 French 102/ })).toBeVisible();
		expect(screen.getAllByRole('checkbox')).toHaveLength(3);
		for (const checkbox of screen.getAllByRole('checkbox')) {
			expect(checkbox).toBeChecked();
		}
		expect(screen.getByText('3 titles selected')).toBeVisible();
		expect(screen.getByRole('button', { name: 'Add 3 books to cart' })).toBeEnabled();
		expect(document.title).toBe(`Books for Mme Tremblay | ${clubContent.name}`);
		expect(container).not.toHaveTextContent(/pickup|checkout|payment|service fee|tax|in stock/i);
	});

	it('preserves a draft quantity through deselection and reselection', async () => {
		renderFrenchList();
		const increment = screen.getByRole('button', {
			name: 'Increase quantity for Le Petit Prince'
		});

		await fireEvent.click(increment);
		await fireEvent.click(increment);
		expect(screen.getByLabelText('Quantity for Le Petit Prince')).toHaveTextContent('3');

		await fireEvent.click(screen.getByRole('checkbox', { name: 'Select Le Petit Prince' }));
		expect(screen.queryByLabelText('Quantity for Le Petit Prince')).not.toBeInTheDocument();
		expect(screen.getByText('2 titles selected')).toBeVisible();

		await fireEvent.click(screen.getByRole('checkbox', { name: 'Select Le Petit Prince' }));
		expect(screen.getByLabelText('Quantity for Le Petit Prince')).toHaveTextContent('3');
		expect(screen.getByRole('button', { name: 'Add 5 books to cart' })).toBeEnabled();
	});

	it('applies the current teacher selection without duplicating it or altering another teacher', async () => {
		const cart = createTestCart();
		cart.setQuantity('the-great-gatsby', 2);
		cart.setQuantity('le-petit-prince', 7);
		renderFrenchList(cart);

		await fireEvent.click(
			screen.getByRole('button', { name: 'Increase quantity for Le Petit Prince' })
		);
		await fireEvent.click(screen.getByRole('checkbox', { name: 'Select Bescherelle' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Update cart with 3 books' }));

		expect(currentCart(cart)).toEqual({
			items: [
				{ bookId: 'the-great-gatsby', quantity: 2 },
				{ bookId: 'le-petit-prince', quantity: 2 },
				{ bookId: 'antigone', quantity: 1 }
			]
		});
		expect(screen.getByText('Cart updated with 2 titles and 3 books.')).toBeVisible();

		await fireEvent.click(screen.getByRole('button', { name: 'Update cart with 3 books' }));
		expect(currentCart(cart)).toEqual({
			items: [
				{ bookId: 'the-great-gatsby', quantity: 2 },
				{ bookId: 'le-petit-prince', quantity: 2 },
				{ bookId: 'antigone', quantity: 1 }
			]
		});
	});

	it('directs the student to select a title when the draft is empty', async () => {
		renderFrenchList();

		for (const checkbox of screen.getAllByRole('checkbox')) {
			await fireEvent.click(checkbox);
		}

		expect(screen.getByText('No books selected')).toBeVisible();
		expect(screen.getByRole('button', { name: 'Select a book to continue' })).toBeDisabled();
	});

	it('can remove this teacher list while retaining another teacher in the cart', async () => {
		const cart = createTestCart();
		cart.setQuantity('the-great-gatsby', 2);
		cart.setQuantity('le-petit-prince', 1);
		cart.setQuantity('antigone', 1);
		renderFrenchList(cart);

		for (const checkbox of screen.getAllByRole('checkbox')) {
			await fireEvent.click(checkbox);
		}

		await fireEvent.click(screen.getByRole('button', { name: 'Remove this list from cart' }));
		expect(currentCart(cart)).toEqual({
			items: [{ bookId: 'the-great-gatsby', quantity: 2 }]
		});
	});
});
