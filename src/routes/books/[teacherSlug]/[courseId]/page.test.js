import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { BOOK_CART_CONTEXT_KEY } from '$lib/books/cart-context';
import { createBookCartStore } from '$lib/books/cart-store';
import { clubContent } from '$lib/content/club';
import { catalogue } from '../../../../test/fixtures/book-catalogue';
import CourseBooksPage from './+page.svelte';

function load() {
	const teacher = catalogue.teachers.find((candidate) => candidate.slug === 'mme-tremblay');
	const course = catalogue.courses.find((candidate) => candidate.id === 'french-101');
	if (!teacher || !course) throw new Error('Course fixture is incomplete');
	const bookstores = new Map(catalogue.bookstores.map((bookstore) => [bookstore.id, bookstore]));
	return {
		launchState: 'live',
		teacher,
		course: {
			...course,
			books: catalogue.books
				.filter((book) => book.courseId === course.id)
				.map((book) => ({
					...book,
					bookstoreName: bookstores.get(book.bookstoreId)?.name ?? 'Bookstore'
				}))
		}
	};
}

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
	return createBookCartStore('course-page-test-cart', createMemoryStorage());
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
function renderFrench101(cart = createTestCart()) {
	const data = load();
	const view = render(CourseBooksPage, {
		props: { data },
		context: new Map([[BOOK_CART_CONTEXT_KEY, cart]])
	});

	return { ...view, cart, data };
}

afterEach(cleanup);

describe('course book list page', () => {
	it('starts with only the course books selected and course-specific metadata', () => {
		const { container } = renderFrench101();

		expect(screen.getByRole('heading', { level: 1, name: 'FRE-101 French 101' })).toBeVisible();
		expect(screen.getByRole('heading', { level: 2, name: 'Books for this course' })).toBeVisible();
		expect(container.querySelectorAll('h1')).toHaveLength(1);
		expect(screen.getByText('Mme Tremblay')).toBeVisible();
		expect(screen.getAllByRole('checkbox')).toHaveLength(2);
		for (const checkbox of screen.getAllByRole('checkbox')) {
			expect(checkbox).toBeChecked();
		}
		expect(screen.queryByRole('checkbox', { name: 'Select Antigone' })).not.toBeInTheDocument();
		expect(screen.getByText('2 titles selected')).toBeVisible();
		expect(screen.getByRole('button', { name: 'Add to cart' })).toBeEnabled();
		expect(document.title).toBe(`FRE-101 books | ${clubContent.name}`);
		expect(container).not.toHaveTextContent(
			/teacher book list|course checklist|courses on this list/i
		);
		expect(container).not.toHaveTextContent(/pickup|checkout|payment|service fee|tax|in stock/i);
	});

	it('offers the cart after saving and switches to modify only while the draft differs', async () => {
		renderFrench101();

		await fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
		await waitFor(() => {
			expect(screen.getByRole('link', { name: 'Go to cart' })).toHaveAttribute(
				'href',
				'/books/cart'
			);
		});

		await fireEvent.click(screen.getByRole('checkbox', { name: 'Select Bescherelle' }));
		expect(screen.getByRole('button', { name: 'Modify cart' })).toBeEnabled();
		expect(screen.queryByRole('link', { name: 'Go to cart' })).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole('checkbox', { name: 'Select Bescherelle' }));
		expect(screen.getByRole('link', { name: 'Go to cart' })).toBeVisible();
	});

	it('gives every book a named row and an individual selection control', () => {
		renderFrench101();

		expect(screen.getByRole('article', { name: 'Le Petit Prince' })).toContainElement(
			screen.getByRole('checkbox', { name: 'Select Le Petit Prince' })
		);
		expect(screen.getByRole('article', { name: 'Bescherelle' })).toContainElement(
			screen.getByRole('checkbox', { name: 'Select Bescherelle' })
		);
	});

	it('passes each supplied storefront URL to its bookstore link', () => {
		const cart = createTestCart();
		const loaded = load();
		const data = {
			...loaded,
			course: {
				...loaded.course,
				books: loaded.course.books.map((book) => ({
					...book,
					storefrontUrl: `https://bookstore.example/${book.id}`
				}))
			}
		};

		render(CourseBooksPage, {
			props: { data },
			context: new Map([[BOOK_CART_CONTEXT_KEY, cart]])
		});

		expect(
			screen.getAllByRole('link', { name: 'View at Renaud-Bray, opens in a new tab' })
		).toHaveLength(2);
		expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
			'https://bookstore.example/le-petit-prince',
			'https://bookstore.example/bescherelle'
		]);
	});

	it('explains when the course has no listed books', () => {
		const cart = createTestCart();
		const loaded = load();
		const data = { ...loaded, course: { ...loaded.course, books: [] } };

		render(CourseBooksPage, {
			props: { data },
			context: new Map([[BOOK_CART_CONTEXT_KEY, cart]])
		});

		expect(screen.getByText('No books are listed for this course.')).toBeVisible();
		expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});

	it('applies only the current course selection while retaining another course in the cart', async () => {
		const cart = createTestCart();
		cart.setQuantity('antigone', 2, 'french-102');
		cart.setQuantity('le-petit-prince', 7, 'french-101');
		renderFrench101(cart);

		await fireEvent.click(screen.getByRole('checkbox', { name: 'Select Bescherelle' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Modify cart' }));

		await waitFor(() => {
			expect(currentCart(cart)).toEqual({
				items: [
					{ courseId: 'french-102', bookId: 'antigone', quantity: 2 },
					{ courseId: 'french-101', bookId: 'le-petit-prince', quantity: 1 }
				]
			});
			expect(screen.getByText('Cart updated with 1 title and 1 book.')).toBeVisible();
		});
	});

	it('can remove only this course from the cart after every title is deselected', async () => {
		const cart = createTestCart();
		cart.setQuantity('antigone', 2, 'french-102');
		cart.setQuantity('le-petit-prince', 1, 'french-101');
		cart.setQuantity('bescherelle', 1, 'french-101');
		renderFrench101(cart);

		for (const checkbox of screen.getAllByRole('checkbox')) {
			await fireEvent.click(checkbox);
		}

		await fireEvent.click(screen.getByRole('button', { name: 'Modify cart' }));
		await waitFor(() => {
			expect(currentCart(cart)).toEqual({
				items: [{ courseId: 'french-102', bookId: 'antigone', quantity: 2 }]
			});
		});
	});
});
