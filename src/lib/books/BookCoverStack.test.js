import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import BookCoverStack from './BookCoverStack.svelte';

const books = [
	{
		id: 'first-book',
		courseId: 'french-101',
		title: 'First assigned book',
		author: 'First Author',
		format: 'Paperback',
		priceCents: 1895,
		bookstoreId: 'renaud-bray',
		storefrontUrl: null,
		coverUrl: null,
		coverTheme: 'coral'
	},
	{
		id: 'second-book',
		courseId: 'french-101',
		title: 'Second assigned book',
		author: 'Second Author',
		format: 'Hardcover',
		priceCents: 2495,
		bookstoreId: 'renaud-bray',
		storefrontUrl: null,
		coverUrl: null,
		coverTheme: 'sky'
	},
	{
		id: 'third-book',
		courseId: 'french-102',
		title: 'Third assigned book',
		author: 'Third Author',
		format: 'Paperback',
		priceCents: 1695,
		bookstoreId: 'archambault',
		storefrontUrl: null,
		coverUrl: null,
		coverTheme: 'midnight'
	},
	{
		id: 'fourth-book',
		courseId: 'english-101',
		title: 'Fourth assigned book',
		author: 'Fourth Author',
		format: 'Paperback',
		priceCents: 1795,
		bookstoreId: 'archambault',
		storefrontUrl: null,
		coverUrl: null,
		coverTheme: 'paper'
	}
];

describe('BookCoverStack', () => {
	it('keeps the supplied order while limiting the stack to three books', () => {
		const { container } = render(BookCoverStack, { props: { books } });
		const covers = [...container.querySelectorAll('[data-size="card"]')];

		expect(covers).toHaveLength(3);
		expect(covers[0]).toContainElement(screen.getByText('First assigned book'));
		expect(covers[1]).toContainElement(screen.getByText('Second assigned book'));
		expect(covers[2]).toContainElement(screen.getByText('Third assigned book'));
		expect(container).not.toHaveTextContent('Fourth assigned book');
	});

	it('honors a smaller visible-book cap without exceeding three', async () => {
		const view = render(BookCoverStack, { props: { books, maxVisible: 2 } });

		expect(view.container.querySelectorAll('[data-size="card"]')).toHaveLength(2);

		await view.rerender({ books, maxVisible: 8 });

		expect(view.container.querySelectorAll('[data-size="card"]')).toHaveLength(3);
	});

	it('keeps the stack and every nested cover out of the accessibility tree', () => {
		const { container } = render(BookCoverStack, { props: { books } });
		const stack = container.firstElementChild;
		const covers = [...container.querySelectorAll('[data-size="card"]')];

		expect(stack).toHaveAttribute('aria-hidden', 'true');
		expect(screen.queryByRole('img')).not.toBeInTheDocument();
		expect(container.querySelector('[aria-label]')).not.toBeInTheDocument();
		expect(covers.every((cover) => cover.getAttribute('aria-hidden') === 'true')).toBe(true);
	});

	it('renders sourced and generated card-sized BookCover output', () => {
		const sourcedBooks = [{ ...books[0], coverUrl: '/covers/first-book.webp' }, books[1]];
		const { container } = render(BookCoverStack, { props: { books: sourcedBooks } });
		const sourcedCover = container.querySelector('img');
		const fallbackCover = container.querySelector('.book-cover--fallback');

		expect(sourcedCover).toHaveAttribute('src', '/covers/first-book.webp');
		expect(sourcedCover).toHaveAttribute('alt', '');
		expect(sourcedCover).toHaveAttribute('data-theme', 'coral');
		expect(sourcedCover).toHaveAttribute('data-size', 'card');
		expect(fallbackCover).toHaveAttribute('data-theme', 'sky');
		expect(fallbackCover).toHaveAttribute('data-size', 'card');
	});
});
