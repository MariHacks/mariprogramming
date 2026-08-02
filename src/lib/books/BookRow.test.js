import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BookRow from './BookRow.svelte';
import { catalogue } from './catalogue';

const book = {
	...catalogue.books[0],
	coverUrl: '/covers/le-petit-prince.webp',
	storefrontUrl: 'https://www.renaud-bray.com/books/le-petit-prince'
};

const props = {
	book,
	bookstoreName: 'Renaud-Bray',
	selected: true,
	quantity: 2
};

afterEach(cleanup);

describe('BookRow', () => {
	it('presents a meaningful left cover and the complete book record', () => {
		const { container } = render(BookRow, { props });
		const cover = screen.getByRole('img', { name: 'Cover of Le Petit Prince' });
		const details = /** @type {HTMLElement} */ (container.querySelector('.book-row__details'));

		expect(cover).toHaveAttribute('src', '/covers/le-petit-prince.webp');
		expect(cover.compareDocumentPosition(details)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(screen.getByRole('heading', { level: 3, name: 'Le Petit Prince' })).toBeVisible();
		expect(screen.getByText('Antoine de Saint-Exupéry')).toBeVisible();
		expect(screen.getByText('Paperback')).toBeVisible();
		expect(screen.getByText('Renaud-Bray')).toBeVisible();
		expect(screen.getByText('$18.95')).toBeVisible();
	});

	it('reflects parent selection and requests a selection change with the book ID', async () => {
		const view = render(BookRow, { props });
		const handleSelectionChange = vi.fn();
		view.component.$on('selectionchange', handleSelectionChange);
		const checkbox = screen.getByRole('checkbox', { name: 'Select Le Petit Prince' });

		expect(checkbox).toBeChecked();

		await fireEvent.click(checkbox);

		expect(handleSelectionChange).toHaveBeenCalledOnce();
		expect(handleSelectionChange.mock.calls[0][0].detail).toEqual({
			bookId: 'le-petit-prince',
			selected: false
		});
	});

	it('disables selection and quantity controls while its parent is not interactive', () => {
		render(BookRow, { props: { ...props, interactive: false } });

		expect(screen.getByRole('checkbox', { name: 'Select Le Petit Prince' })).toBeDisabled();
		expect(
			screen.getByRole('button', { name: 'Decrease quantity for Le Petit Prince' })
		).toBeDisabled();
		expect(
			screen.getByRole('button', { name: 'Increase quantity for Le Petit Prince' })
		).toBeDisabled();
	});

	it('hides quantity controls while deselected and restores the parent quantity on reselection', async () => {
		const view = render(BookRow, {
			props: { ...props, selected: false, quantity: 3 }
		});

		expect(screen.queryByRole('button', { name: /quantity/i })).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Quantity for Le Petit Prince')).not.toBeInTheDocument();

		await view.rerender({ ...props, selected: true, quantity: 3 });

		expect(screen.getByLabelText('Quantity for Le Petit Prince')).toHaveTextContent('3');
		expect(
			screen.getByRole('button', { name: 'Decrease quantity for Le Petit Prince' })
		).toBeVisible();
		expect(
			screen.getByRole('button', { name: 'Increase quantity for Le Petit Prince' })
		).toBeVisible();
	});

	it('requests bounded quantity changes without owning the parent state', async () => {
		const view = render(BookRow, { props });
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

	it('does not request a quantity below one', async () => {
		const view = render(BookRow, { props: { ...props, quantity: 1 } });
		const handleQuantityChange = vi.fn();
		view.component.$on('quantitychange', handleQuantityChange);
		const decrement = screen.getByRole('button', {
			name: 'Decrease quantity for Le Petit Prince'
		});

		expect(decrement).toBeDisabled();
		await fireEvent.click(decrement);
		expect(handleQuantityChange).not.toHaveBeenCalled();
	});

	it('opens a verified retailer URL in a secured new tab', () => {
		render(BookRow, { props });
		const link = screen.getByRole('link', {
			name: 'View at Renaud-Bray, opens in a new tab'
		});

		expect(link).toHaveAttribute('href', 'https://www.renaud-bray.com/books/le-petit-prince');
		expect(link).toHaveAttribute('target', '_blank');
		expect(link).toHaveAttribute('rel', 'noreferrer');
	});

	it.each([null, '', '   '])('omits the retailer action for %j URLs', (storefrontUrl) => {
		const { container } = render(BookRow, {
			props: { ...props, book: { ...book, storefrontUrl } }
		});

		expect(screen.queryByRole('link', { name: /View at/i })).not.toBeInTheDocument();
		expect(container).not.toHaveTextContent(/pickup|cart|checkout|payment/i);
	});
});
