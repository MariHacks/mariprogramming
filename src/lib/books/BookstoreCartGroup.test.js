import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BookstoreCartGroup from './BookstoreCartGroup.svelte';
import { catalogue } from './catalogue';

const bookstore = { id: 'renaud-bray', name: 'Renaud-Bray' };
const lines = [
	{
		book: { ...catalogue.books[0], priceCents: 100 },
		quantity: 2,
		unitPriceCents: 1895,
		amountCents: 3790
	},
	{
		book: { ...catalogue.books[1], coverUrl: '/covers/bescherelle.webp' },
		quantity: 1,
		unitPriceCents: 2995,
		amountCents: 2995
	}
];
const fee = { label: 'Renaud-Bray pickup service', amountCents: 500 };
const props = { bookstore, lines, fee };

afterEach(cleanup);

describe('BookstoreCartGroup', () => {
	it('renders one named bookstore section with its supplied fee and book count', () => {
		render(BookstoreCartGroup, { props });
		const group = screen.getByRole('region', { name: 'Renaud-Bray' });

		expect(screen.getAllByRole('region')).toHaveLength(1);
		expect(within(group).getByText('2 books')).toBeVisible();
		expect(within(group).getAllByText('Renaud-Bray pickup service')).toHaveLength(1);
		expect(within(group).getAllByText('$5.00')).toHaveLength(1);
	});

	it('uses singular book wording for a one-line bookstore group', async () => {
		const view = render(BookstoreCartGroup, { props });

		await view.rerender({ ...props, lines: [lines[0]] });

		expect(screen.getByText('1 book')).toBeVisible();
		expect(screen.queryByText('2 books')).not.toBeInTheDocument();
	});

	it('keeps every supplied cover on the left and presents canonical line prices', () => {
		const { container } = render(BookstoreCartGroup, { props });

		for (const [book, unitPrice, lineTotal] of [
			['Le Petit Prince', '$18.95', '$37.90'],
			['Bescherelle', '$29.95', '$29.95']
		]) {
			const title = screen.getByRole('heading', { level: 3, name: book });
			const line = /** @type {HTMLElement} */ (title.closest('li'));
			const cover = within(line).getByRole('img', { name: new RegExp(`Cover.*${book}`) });

			expect(cover).toHaveClass('book-cover--compact');
			expect(cover.compareDocumentPosition(title)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(within(line).getByText('Unit price')).toBeVisible();
			expect(within(line).getByText('Line total')).toBeVisible();
			expect(
				within(line)
					.getAllByRole('definition')
					.map((definition) => definition.textContent)
			).toEqual([unitPrice, lineTotal]);
		}

		expect(screen.getByText('Antoine de Saint-Exupéry')).toBeVisible();
		expect(screen.getByText('Paperback')).toBeVisible();
		expect(container).not.toHaveTextContent(/checkout|payment|tax|discount|total due/i);
	});

	it('requests quantity changes with the affected book ID without mutating a cart', async () => {
		const view = render(BookstoreCartGroup, { props });
		const handleQuantityChange = vi.fn();
		view.component.$on('quantitychange', handleQuantityChange);

		await fireEvent.click(
			screen.getByRole('button', { name: 'Decrease quantity for Le Petit Prince' })
		);
		await fireEvent.click(
			screen.getByRole('button', { name: 'Increase quantity for Le Petit Prince' })
		);

		expect(handleQuantityChange.mock.calls.map(([event]) => event.detail)).toEqual([
			{ bookId: 'le-petit-prince', quantity: 1 },
			{ bookId: 'le-petit-prince', quantity: 3 }
		]);
	});

	it('prevents a below-one request and removes the correct one-quantity line on demand', async () => {
		const view = render(BookstoreCartGroup, { props });
		const handleQuantityChange = vi.fn();
		const handleRemove = vi.fn();
		view.component.$on('quantitychange', handleQuantityChange);
		view.component.$on('remove', handleRemove);
		const decrement = screen.getByRole('button', {
			name: 'Decrease quantity for Bescherelle'
		});

		expect(decrement).toBeDisabled();
		await fireEvent.click(decrement);
		await fireEvent.click(screen.getByRole('button', { name: 'Remove Bescherelle' }));

		expect(handleQuantityChange).not.toHaveBeenCalled();
		expect(handleRemove).toHaveBeenCalledOnce();
		expect(handleRemove.mock.calls[0][0].detail).toEqual({ bookId: 'bescherelle' });
	});
});
