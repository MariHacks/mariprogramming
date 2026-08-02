import { cleanup, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { writable } from 'svelte/store';
import { afterEach, describe, expect, it } from 'vitest';
import BookDeliveryBar from './BookDeliveryBar.svelte';

afterEach(cleanup);

describe('BookDeliveryBar', () => {
	it('links to the catalogue and an empty cart without adding other controls', () => {
		const cart = writable({ items: [] });
		const { container } = render(BookDeliveryBar, { props: { cart } });

		expect(screen.getByRole('link', { name: 'Book Delivery' })).toHaveAttribute('href', '/books');
		expect(screen.getByRole('link', { name: 'Cart, 0 items' })).toHaveAttribute(
			'href',
			'/books/cart'
		);
		expect(container.querySelectorAll('a[href], button, input, select, textarea')).toHaveLength(2);
	});

	it('uses singular wording for a cart containing one book', () => {
		const cart = writable({ items: [{ bookId: 'antigone', quantity: 1 }] });

		render(BookDeliveryBar, { props: { cart } });

		expect(screen.getByRole('link', { name: 'Cart, 1 item' })).toBeInTheDocument();
	});

	it('sums quantities and updates the cart name when the store emits', async () => {
		const cart = writable({
			items: [
				{ bookId: 'antigone', quantity: 2 },
				{ bookId: 'bescherelle', quantity: 1 }
			]
		});

		render(BookDeliveryBar, { props: { cart } });

		expect(screen.getByRole('link', { name: 'Cart, 3 items' })).toBeInTheDocument();

		cart.set({ items: [{ bookId: 'gatsby', quantity: 4 }] });
		await tick();

		expect(screen.getByRole('link', { name: 'Cart, 4 items' })).toBeInTheDocument();
		expect(screen.queryByRole('link', { name: 'Cart, 3 items' })).not.toBeInTheDocument();
	});
});
