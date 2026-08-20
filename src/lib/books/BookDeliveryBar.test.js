import { cleanup, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { compile } from 'svelte/compiler';
import { writable } from 'svelte/store';
import { afterEach, describe, expect, it } from 'vitest';
import BookDeliveryBar from './BookDeliveryBar.svelte';
import bookDeliveryBarSource from './BookDeliveryBar.svelte?raw';

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

	it('gives both local navigation links a 44 pixel minimum touch target', () => {
		expect(bookDeliveryBarSource).toMatch(
			/\.service-link,\s*\.cart-link\s*\{[\s\S]*?min-height:\s*2\.75rem;/
		);
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

	it('replays the shared fast state transition when the cart count changes', async () => {
		/** @type {import('svelte/store').Writable<{ items: { bookId: string, quantity: number }[] }>} */
		const cart = writable({ items: [] });
		const { container } = render(BookDeliveryBar, { props: { cart } });
		const initialCount = container.querySelector('.cart-count');
		const { css } = compile(bookDeliveryBarSource, {
			generate: 'client',
			cssHash: () => 'scope'
		});

		cart.set({ items: [{ bookId: 'antigone', quantity: 1 }] });
		await tick();

		const updatedCount = container.querySelector('.cart-count');
		expect(updatedCount).not.toBe(initialCount);
		expect(css?.code).toMatch(
			/\.cart-count[^{}]*\{[^{}]*animation:\s*cart-count-change var\(--motion-fast\) var\(--ease-out\) both/
		);
		const reducedMotionCss = css?.code.split('@media (prefers-reduced-motion: reduce)')[1] ?? '';
		expect(reducedMotionCss).toContain('.cart-count');
		expect(reducedMotionCss).toContain('animation-duration: var(--motion-press) !important');
		expect(reducedMotionCss).toContain('transform: none !important');
	});
});
